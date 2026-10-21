import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { createAppPassword } from '../src/lib/server/auth/client';
import { invalidateConfig } from '../src/lib/server/store';
import type { Manifest, Meta, MetaPreview, Stream } from '../src/lib/server/stremio/types';
import worker from './entry';
import { network } from './network';

export const ORIGIN = 'https://media.test';
export const ADDON_URL = 'https://addon.test';
export const LIBRARY_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const SHOWS_LIBRARY_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

export const manifest: Manifest = {
	id: 'test.addon',
	name: 'Test Addon',
	version: '1.0.0',
	types: ['movie', 'series'],
	idPrefixes: ['tt'],
	resources: ['catalog', 'meta', 'stream'],
	catalogs: [
		{ type: 'movie', id: 'top', name: 'Top', extra: [{ name: 'skip' }, { name: 'search' }] },
		{ type: 'series', id: 'shows', name: 'Shows' }
	]
};

export const movies: MetaPreview[] = [
	{
		id: 'tt0000001',
		type: 'movie',
		name: 'Alpha',
		poster: 'https://img.test/1.jpg',
		releaseInfo: '2001',
		runtime: '100 min'
	},
	{
		id: 'tt0000002',
		type: 'movie',
		name: 'Bravo',
		poster: 'https://img.test/2.jpg',
		releaseInfo: '2002'
	},
	{ id: 'tt0000003', type: 'movie', name: 'Charlie', releaseInfo: '2003' }
];

export const show: Meta = {
	id: 'tt0000010',
	type: 'series',
	name: 'Delta',
	poster: 'https://img.test/10.jpg',
	runtime: '45 min',
	videos: [
		{ id: 'tt0000010:1:2', season: 1, episode: 2, name: 'Second' },
		{ id: 'tt0000010:1:1', season: 1, episode: 1, name: 'First' },
		{ id: 'tt0000010:0:1', season: 0, episode: 1, name: 'Special' },
		{ id: 'tt0000010:2:1', season: 2, number: 1, name: 'Next season' },
		{ id: 'tt0000010:extra', name: 'Behind the scenes' }
	]
};

export const movieStreams: Stream[] = [
	{
		url: 'https://cdn.test/alpha-1080.mkv',
		name: 'Test',
		title: '1080p\n2 GB',
		behaviorHints: { filename: 'alpha.mkv' }
	},
	{ infoHash: 'abcdef' },
	{
		url: 'https://cdn.test/proxied.mkv',
		behaviorHints: { proxyHeaders: { request: { referer: 'x' } } }
	},
	{ url: 'https://cdn.test/alpha-720.mp4', name: 'Test', title: '720p' }
];

/** Fake addon: the movie catalog pages two items at a time. */
export function mockAddon(streams: Record<string, Stream[]> = { tt0000001: movieStreams }): void {
	network.use(
		http.get(`${ADDON_URL}/manifest.json`, () => HttpResponse.json(manifest)),
		http.get(`${ADDON_URL}/catalog/movie/top.json`, () =>
			HttpResponse.json({ metas: movies.slice(0, 2) })
		),
		http.get(`${ADDON_URL}/catalog/movie/top/:extra`, ({ params }) => {
			const extra = decodeURIComponent(String(params.extra).replace(/\.json$/, ''));
			if (extra.startsWith('skip=')) {
				const skip = Number(extra.slice(5));
				return HttpResponse.json({ metas: movies.slice(skip, skip + 2) });
			}
			const term = extra.replace('search=', '').toLowerCase();
			return HttpResponse.json({
				metas: movies.filter((movie) => movie.name.toLowerCase().includes(term))
			});
		}),
		http.get(`${ADDON_URL}/catalog/series/shows.json`, () => HttpResponse.json({ metas: [show] })),
		http.get(`${ADDON_URL}/catalog/series/shows/:extra`, () => HttpResponse.json({ metas: [] })),
		http.get(`${ADDON_URL}/meta/movie/:id`, ({ params }) => {
			const id = String(params.id).replace(/\.json$/, '');
			const meta = movies.find((movie) => movie.id === id);
			return meta ? HttpResponse.json({ meta }) : HttpResponse.json({ meta: null });
		}),
		http.get(`${ADDON_URL}/meta/series/:id`, () => HttpResponse.json({ meta: show })),
		http.get(`${ADDON_URL}/stream/:type/:id`, ({ params }) => {
			const id = decodeURIComponent(String(params.id).replace(/\.json$/, ''));
			return HttpResponse.json({ streams: streams[id] ?? [] });
		})
	);
}

export async function seed(): Promise<void> {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM libraries'),
		env.DB.prepare('DELETE FROM addons'),
		env.DB.prepare('DELETE FROM sessions'),
		env.DB.prepare('DELETE FROM app_passwords'),
		env.DB.prepare('DELETE FROM scrobble_accounts'),
		env.DB.prepare('DELETE FROM settings'),
		env.DB.prepare(
			"INSERT INTO addons (id, url, manifest, enabled, position) VALUES ('test', ?, ?, 1, 0)"
		).bind(ADDON_URL, JSON.stringify(manifest)),
		env.DB.prepare(
			"INSERT INTO libraries (id, kind, addon_id, catalog_type, catalog_id, name, enabled, position) VALUES (?, 'catalog', 'test', 'movie', 'top', 'Top Movies', 1, 0)"
		).bind(LIBRARY_ID),
		env.DB.prepare(
			"INSERT INTO libraries (id, kind, addon_id, catalog_type, catalog_id, name, enabled, position) VALUES (?, 'catalog', 'test', 'series', 'shows', 'Shows', 1, 1)"
		).bind(SHOWS_LIBRARY_ID)
	]);
	invalidateConfig();
}

export async function call(path: string, init: RequestInit = {}): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch!(
		new Request(`${ORIGIN}${path}`, init) as Request<unknown, IncomingRequestCfProperties>,
		env,
		ctx
	);
	await waitOnExecutionContext(ctx);
	return response;
}

export async function login(): Promise<string> {
	const { password } = await createAppPassword(env.DB, 'Test device');
	const response = await call('/Users/AuthenticateByName', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'MediaBrowser Client="Tests", Device="Vitest", DeviceId="1", Version="1.0"',
			// Each login comes from its own address so the login rate limit does not trip across tests.
			'cf-connecting-ip': `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
		},
		body: JSON.stringify({ Username: 'admin', Pw: password })
	});
	const body = (await response.json()) as { AccessToken: string };
	return body.AccessToken;
}

export function authed(token: string, init: RequestInit = {}): RequestInit {
	return { ...init, headers: { ...init.headers, 'x-emby-token': token } };
}

export async function getJson<T>(path: string, token: string): Promise<T> {
	const response = await call(path, authed(token));
	if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
	return (await response.json()) as T;
}
