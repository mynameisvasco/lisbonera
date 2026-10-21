import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
	ADDON_URL,
	authed,
	call,
	getJson,
	LIBRARY_ID,
	login,
	mockAddon,
	movieStreams,
	seed
} from './helpers';
import { network } from './network';

interface Source {
	Protocol: string;
	IsRemote: boolean;
	Id: string;
	Name: string;
	Path: string;
	Container: string;
	SupportsDirectPlay: boolean;
	SupportsTranscoding: boolean;
}

let token: string;
let movieId: string;

beforeEach(async () => {
	await seed();
	mockAddon();
	token = await login();
	const { Items } = await getJson<{ Items: { Id: string }[] }>(
		`/Items?ParentId=${LIBRARY_ID}`,
		token
	);
	movieId = Items[0].Id;
});

describe('PlaybackInfo', () => {
	it('PlaybackInfo drops non-http and proxyHeaders streams', async () => {
		const response = await call(
			`/Items/${movieId}/PlaybackInfo`,
			authed(token, { method: 'POST' })
		);
		const body = (await response.json()) as {
			MediaSources: Source[];
			PlaySessionId: string;
			ErrorCode?: string;
		};
		expect(body.ErrorCode).toBeUndefined();
		expect(body.MediaSources.map((source) => source.Name)).toEqual(['Test · 1080p', 'Test · 720p']);
		const [first] = body.MediaSources;
		expect(first.Id).toMatch(/^[0-9a-f]{32}$/);
		expect(first.Path).toBe('Alpha (2001)');
		expect(first.Container).toBe('mkv');
		expect(first.SupportsDirectPlay).toBe(true);
		expect(first.SupportsTranscoding).toBe(false);
		expect(first).toMatchObject({ Protocol: 'File', IsRemote: false });
	});

	it('does not cache an empty source list', async () => {
		const { Items } = await getJson<{ Items: { Id: string }[] }>(
			`/Items?ParentId=${LIBRARY_ID}`,
			token
		);
		const charlie = Items[2].Id;
		network.use(
			http.get(`${ADDON_URL}/stream/:type/:id`, () => HttpResponse.json({}, { status: 503 }))
		);
		const empty = await call(`/Items/${charlie}/PlaybackInfo`, authed(token, { method: 'POST' }));
		expect(await empty.json()).toMatchObject({ ErrorCode: 'NoCompatibleStream' });
		network.resetHandlers();
		mockAddon({ tt0000003: movieStreams });
		const retry = (await (
			await call(`/Items/${charlie}/PlaybackInfo`, authed(token, { method: 'POST' }))
		).json()) as { MediaSources: Source[] };
		expect(retry.MediaSources).toHaveLength(2);
	});

	it('no sources → NoCompatibleStream', async () => {
		const { Items } = await getJson<{ Items: { Id: string }[] }>(
			`/Items?ParentId=${LIBRARY_ID}`,
			token
		);
		const response = await call(
			`/Items/${Items[1].Id}/PlaybackInfo`,
			authed(token, { method: 'POST' })
		);
		expect(await response.json()).toMatchObject({
			MediaSources: [],
			ErrorCode: 'NoCompatibleStream'
		});
	});

	it('exposes the same sources on the item detail', async () => {
		const detail = await getJson<{ MediaSources: Source[] }>(`/Users/me/Items/${movieId}`, token);
		const info = (await (
			await call(`/Items/${movieId}/PlaybackInfo`, authed(token, { method: 'POST' }))
		).json()) as {
			MediaSources: Source[];
		};
		expect(detail.MediaSources.map((source) => source.Id)).toEqual(
			info.MediaSources.map((source) => source.Id)
		);
	});
});

describe('stream', () => {
	it('redirects to the chosen source', async () => {
		const info = (await (
			await call(`/Items/${movieId}/PlaybackInfo`, authed(token, { method: 'POST' }))
		).json()) as {
			MediaSources: Source[];
		};
		const second = info.MediaSources[1];
		const response = await call(
			`/Videos/${movieId}/stream.mp4?Static=true&MediaSourceId=${second.Id}&api_key=${token}`
		);
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://cdn.test/alpha-720.mp4');
	});

	it('stream redirects to first source when id unknown', async () => {
		const response = await call(
			`/Videos/${movieId}/stream?MediaSourceId=${movieId}`,
			authed(token)
		);
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://cdn.test/alpha-1080.mkv');
		const download = await call(`/Items/${movieId}/Download`, authed(token));
		expect(download.headers.get('location')).toBe('https://cdn.test/alpha-1080.mkv');
	});

	it('requires authentication', async () => {
		expect((await call(`/Videos/${movieId}/stream`)).status).toBe(401);
	});
});
