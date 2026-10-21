import { env } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveAccount, saveCredentials } from '../src/lib/server/scrobble/service';
import {
	authed,
	call,
	getJson,
	LIBRARY_ID,
	login,
	mockAddon,
	seed,
	SHOWS_LIBRARY_ID
} from './helpers';
import { network } from './network';

let token: string;
let requests: { path: string; body: unknown }[];

beforeEach(async () => {
	await seed();
	mockAddon();
	token = await login();
	requests = [];
	await saveCredentials(env, 'trakt', { clientId: 'client', clientSecret: 'secret' });
	await saveAccount(
		env,
		'trakt',
		{ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 30 * 86400_000 },
		'owner'
	);
	network.use(
		http.post('https://api.trakt.tv/*', async ({ request }) => {
			requests.push({ path: new URL(request.url).pathname, body: await request.json() });
			return HttpResponse.json({}, { status: 201 });
		}),
		http.get('https://api.trakt.tv/sync/watched/movies', () =>
			HttpResponse.json([{ movie: { ids: { imdb: 'tt0000002', tmdb: 2 } } }])
		),
		http.get('https://api.trakt.tv/sync/playback', () =>
			HttpResponse.json([
				{
					progress: 40,
					paused_at: '2026-10-20T10:00:00Z',
					type: 'movie',
					movie: { ids: { imdb: 'tt0000001' } }
				}
			])
		),
		http.get('https://api.trakt.tv/shows/:id/progress/watched', () =>
			HttpResponse.json({
				seasons: [
					{
						number: 1,
						episodes: [
							{ number: 1, completed: true },
							{ number: 2, completed: false }
						]
					}
				],
				next_episode: { season: 1, number: 2 }
			})
		),
		http.get('https://api.trakt.tv/sync/history/episodes', () =>
			HttpResponse.json([{ show: { ids: { trakt: 7, imdb: 'tt0000010' } } }])
		)
	);
});

async function movieIds() {
	const { Items } = await getJson<{ Items: { Id: string; UserData: { Played: boolean } }[] }>(
		`/Items?ParentId=${LIBRARY_ID}`,
		token
	);
	return Items;
}

describe('scrobbling', () => {
	it('sends start and stop with progress computed from the runtime', async () => {
		const [alpha] = await movieIds();
		const body = (positionMinutes: number) =>
			JSON.stringify({ ItemId: alpha.Id, PositionTicks: positionMinutes * 60 * 10_000_000 });
		await call(
			'/Sessions/Playing',
			authed(token, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: body(0)
			})
		);
		await call(
			'/Sessions/Playing/Stopped',
			authed(token, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: body(90)
			})
		);
		expect(requests.map((request) => request.path)).toEqual(['/scrobble/start', '/scrobble/stop']);
		expect(requests[1].body).toEqual({ movie: { ids: { imdb: 'tt0000001' } }, progress: 90 });
	});

	it('throttles progress reports', async () => {
		const [alpha] = await movieIds();
		const report = () =>
			call(
				'/Sessions/Playing/Progress',
				authed(token, {
					method: 'POST',
					body: JSON.stringify({ ItemId: alpha.Id, PositionTicks: 1 })
				})
			);
		await report();
		await report();
		await report();
		expect(requests.filter((request) => request.path === '/scrobble/start')).toHaveLength(1);
	});

	it('marks items played through history', async () => {
		const [alpha] = await movieIds();
		const response = await call(
			`/Users/me/PlayedItems/${alpha.Id}`,
			authed(token, { method: 'POST' })
		);
		expect(await response.json()).toMatchObject({ Played: true });
		expect(requests[0]).toEqual({
			path: '/sync/history',
			body: { movies: [{ ids: { imdb: 'tt0000001' } }] }
		});
	});

	it('fills watched state, resume and next up from the provider', async () => {
		const items = await movieIds();
		expect(items.map((item) => item.UserData.Played)).toEqual([false, true, false]);

		const resume = await getJson<{
			Items: { Name: string; UserData: { PlaybackPositionTicks: number } }[];
		}>('/Users/me/Items/Resume', token);
		expect(resume.Items.map((item) => item.Name)).toEqual(['Alpha']);
		expect(resume.Items[0].UserData.PlaybackPositionTicks).toBe(40 * 60 * 10_000_000);

		const nextUp = await getJson<{ Items: { Name: string; IndexNumber: number }[] }>(
			'/Shows/NextUp',
			token
		);
		expect(nextUp.Items.map((item) => [item.Name, item.IndexNumber])).toEqual([['Second', 2]]);

		const { Items: shows } = await getJson<{ Items: { Id: string }[] }>(
			`/Items?ParentId=${SHOWS_LIBRARY_ID}`,
			token
		);
		const episodes = await getJson<{ Items: { UserData: { Played: boolean } }[] }>(
			`/Shows/${shows[0].Id}/Episodes?Season=1`,
			token
		);
		expect(episodes.Items.map((item) => item.UserData.Played)).toEqual([true, false]);
	});

	it('keeps playing when the provider fails', async () => {
		network.use(http.post('https://api.trakt.tv/*', () => HttpResponse.json({}, { status: 503 })));
		const [alpha] = await movieIds();
		const response = await call(
			'/Sessions/Playing',
			authed(token, { method: 'POST', body: JSON.stringify({ ItemId: alpha.Id }) })
		);
		expect(response.status).toBe(204);
		const row = await env.DB.prepare(
			"SELECT last_error FROM scrobble_accounts WHERE provider = 'trakt'"
		).first<{ last_error: string }>();
		expect(row?.last_error).toContain('503');
	});
});
