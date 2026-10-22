import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { genreCatalogs } from '../src/lib/server/admin/collections';
import { MDBLIST_API, parseListRef, saveMdblistKey } from '../src/lib/server/mdblist';
import {
	createCollection,
	listAddons,
	listLibraries,
	saveImage,
	updateLibrary
} from '../src/lib/server/store';
import type { Manifest } from '../src/lib/server/stremio/types';
import { ADDON_URL, call, getJson, login, manifest, mockAddon, movies, seed } from './helpers';
import { network } from './network';

interface Item {
	Id: string;
	Name: string;
	ImageTags?: Record<string, string>;
	PrimaryImageAspectRatio?: number;
}

let token: string;

beforeEach(async () => {
	await seed();
	mockAddon();
	token = await login();
});

describe('genre collections', () => {
	it('finds catalogs that list genre options', async () => {
		const withGenres: Manifest = {
			...manifest,
			catalogs: [
				...manifest.catalogs,
				{
					type: 'movie',
					id: 'by-genre',
					name: 'By genre',
					extra: [{ name: 'genre', isRequired: true, options: ['Action', 'Drama', 'Action'] }]
				},
				{ type: 'movie', id: 'needs-search', extra: [{ name: 'search', isRequired: true }] }
			]
		};
		const [addon] = await listAddons(env.DB);
		const catalogs = genreCatalogs([{ ...addon, manifest: withGenres }]);
		expect(catalogs).toEqual([
			expect.objectContaining({
				key: 'test|movie|by-genre',
				type: 'movie',
				genres: ['Action', 'Drama']
			})
		]);
	});

	it('serves a catalog filtered by genre', async () => {
		network.use(
			http.get(`${ADDON_URL}/catalog/movie/top/:extra`, ({ params }) => {
				const extra = decodeURIComponent(String(params.extra));
				return HttpResponse.json({
					metas: extra === 'genre=Drama.json' ? [movies[1]] : []
				});
			})
		);
		const id = await createCollection(env.DB, 'Drama', 'movie', [
			{ kind: 'catalog', addonId: 'test', type: 'movie', catalogId: 'top', genre: 'Drama' }
		]);
		const result = await getJson<{ Items: Item[] }>(`/Items?ParentId=${id}`, token);
		expect(result.Items.map((item) => item.Name)).toEqual(['Bravo']);
	});

	it('is removed with its addon', async () => {
		await createCollection(env.DB, 'Drama', 'movie', [
			{ kind: 'catalog', addonId: 'test', type: 'movie', catalogId: 'top', genre: 'Drama' }
		]);
		await env.DB.prepare('PRAGMA foreign_keys = ON').run();
		await env.DB.prepare("DELETE FROM addons WHERE id = 'test'").run();
		const { results } = await env.DB.prepare("SELECT * FROM libraries WHERE name = 'Drama'").all();
		expect(results).toEqual([]);
	});
});

describe('MDBList collections', () => {
	it('parses list references', () => {
		expect(parseListRef('https://mdblist.com/lists/garycrawfordgc/latest-tv-shows')).toBe(
			'garycrawfordgc/latest-tv-shows'
		);
		expect(parseListRef('https://mdblist.com/lists/user/slug/?sort=rank')).toBe('user/slug');
		expect(parseListRef('user/slug')).toBe('user/slug');
		expect(parseListRef('14')).toBe('14');
		expect(parseListRef('https://example.com/lists/user/slug')).toBeNull();
		expect(parseListRef('just-a-name')).toBeNull();
	});

	it('serves list items with posters and pages past the first response', async () => {
		await saveMdblistKey(env, 'secret-key');
		const entries = Array.from({ length: 101 }, (_, index) => ({
			title: `Title ${index}`,
			imdb_id: `tt${String(index + 100).padStart(7, '0')}`,
			mediatype: index % 2 ? 'show' : 'movie',
			release_year: 2000
		}));
		entries.splice(3, 0, { title: 'No id', imdb_id: '', mediatype: 'movie', release_year: 2000 });
		network.use(
			http.get(`${MDBLIST_API}/lists/user/slug/items`, ({ request }) => {
				const url = new URL(request.url);
				expect(url.searchParams.get('apikey')).toBe('secret-key');
				const offset = Number(url.searchParams.get('offset'));
				return HttpResponse.json(entries.slice(offset, offset + 100));
			})
		);
		const id = await createCollection(env.DB, 'List', 'mixed', [
			{ kind: 'mdblist', list: 'user/slug' }
		]);
		const result = await getJson<{ Items: (Item & { Type: string })[]; TotalRecordCount: number }>(
			`/Items?ParentId=${id}&Limit=200`,
			token
		);
		expect(result.TotalRecordCount).toBe(101);
		expect(result.Items[0]).toMatchObject({ Name: 'Title 0', Type: 'Movie' });
		expect(result.Items[1]).toMatchObject({ Name: 'Title 1', Type: 'Series' });
		expect(result.Items.at(-1)?.Name).toBe('Title 100');
		expect(result.Items[0].ImageTags?.Primary).toBeTruthy();
	});

	it('is empty without an API key', async () => {
		const id = await createCollection(env.DB, 'List', 'mixed', [
			{ kind: 'mdblist', list: 'user/slug' }
		]);
		const result = await getJson<{ Items: Item[] }>(`/Items?ParentId=${id}`, token);
		expect(result.Items).toEqual([]);
	});
});

describe('library artwork', () => {
	it('serves an uploaded image for the library tile', async () => {
		const id = await createCollection(env.DB, 'Picks', 'movie');
		const ref = await saveImage(env.DB, 'image/png', new TextEncoder().encode('png').buffer);
		await updateLibrary(env.DB, id, { image: { url: ref, aspect: 1 } });

		const views = await getJson<{ Items: Item[] }>('/UserViews', token);
		const view = views.Items.find((item) => item.Id === id)!;
		expect(view.ImageTags?.Primary).toBeTruthy();
		expect(view.PrimaryImageAspectRatio).toBe(1);

		const image = await call(`/Items/${id}/Images/Primary?tag=${view.ImageTags!.Primary}`);
		expect(image.status).toBe(200);
		expect(image.headers.get('content-type')).toBe('image/png');
		expect(await image.text()).toBe('png');
	});

	it('proxies a linked image and drops replaced uploads', async () => {
		const id = await createCollection(env.DB, 'Picks', 'movie');
		await updateLibrary(env.DB, id, {
			image: { url: await saveImage(env.DB, 'image/png', new ArrayBuffer(4)), aspect: null }
		});
		await updateLibrary(env.DB, id, { image: { url: 'https://img.test/cover.jpg', aspect: null } });
		const { results } = await env.DB.prepare('SELECT id FROM images').all();
		expect(results).toEqual([]);

		network.use(
			http.get(
				'https://img.test/cover.jpg',
				() => new HttpResponse('jpeg', { headers: { 'content-type': 'image/jpeg' } })
			)
		);
		const views = await getJson<{ Items: Item[] }>('/UserViews', token);
		expect(views.Items.find((item) => item.Id === id)?.PrimaryImageAspectRatio).toBeCloseTo(16 / 9);
		expect(await (await call(`/Items/${id}/Images/Primary`)).text()).toBe('jpeg');
		expect((await listLibraries(env.DB)).find((item) => item.id === id)?.image).toBe(
			'https://img.test/cover.jpg'
		);
	});
});

describe('Trakt list collections', () => {
	it('reads public lists with the API app client ID', async () => {
		const { saveCredentials } = await import('../src/lib/server/scrobble/service');
		await saveCredentials(env, 'trakt', { clientId: 'client-1', clientSecret: 'secret' });
		network.use(
			http.get(
				'https://api.trakt.tv/users/snoak/lists/top-movies/items/movie,show',
				({ request }) => {
					expect(request.headers.get('trakt-api-key')).toBe('client-1');
					return HttpResponse.json([
						{ type: 'movie', movie: { title: 'Alpha', year: 2001, ids: { imdb: 'tt0000001' } } },
						{ type: 'person', person: { name: 'Nobody' } }
					]);
				}
			),
			http.get('https://api.trakt.tv/users/snoak/lists/top-shows/items/movie,show', () =>
				HttpResponse.json([
					{ type: 'show', show: { title: 'Delta', year: 2010, ids: { imdb: 'tt0000010' } } },
					{ type: 'movie', movie: { title: 'Alpha', year: 2001, ids: { imdb: 'tt0000001' } } }
				])
			)
		);
		const id = await createCollection(env.DB, 'Top', 'mixed', [
			{ kind: 'trakt', user: 'snoak', slug: 'top-movies' },
			{ kind: 'trakt', user: 'snoak', slug: 'top-shows' }
		]);
		const result = await getJson<{ Items: (Item & { Type: string })[] }>(
			`/Items?ParentId=${id}`,
			token
		);
		expect(result.Items.map((item) => [item.Name, item.Type])).toEqual([
			['Alpha', 'Movie'],
			['Delta', 'Series']
		]);
	});
});

describe('collection packs', () => {
	it('reads collection and widget exports and plans an import', async () => {
		const { parsePack, planImport } = await import('../src/lib/server/admin/packs');
		const items = parsePack([
			{
				name: 'Action',
				backgroundImageURL: 'https://img.test/action.png',
				layout: 'Poster',
				dataSources: [
					{
						kind: 'traktList',
						payload: {
							username: 'snoak',
							listSlug: 'popular-action-movies',
							listName: 'Popular Action Movies'
						}
					},
					{
						kind: 'traktList',
						payload: {
							username: 'snoak',
							listSlug: 'popular-action-shows',
							listName: 'Popular Action Shows'
						}
					}
				]
			},
			{ name: 'Scifi', backgroundImageURL: 'https://img.test/scifi.png', layout: 'Wide' },
			{ name: 'Broken', backgroundImageURL: 'not a url' }
		]);
		expect(items.map((item) => [item.name, item.shape, item.lists.length])).toEqual([
			['Action', 'poster', 2],
			['Scifi', 'wide', 0]
		]);
		expect(
			parsePack({
				exportType: 'fusionWidgets',
				widgets: [
					{
						dataSource: {
							kind: 'collection',
							payload: {
								items: [
									{ title: 'Bafta', imageURL: 'https://img.test/b.png', imageAspect: 'poster' }
								]
							}
						}
					}
				]
			}).map((item) => item.name)
		).toEqual(['Bafta']);

		const libraries = await listLibraries(env.DB);
		const lists = planImport(items, { mode: 'lists', catalog: null, libraries });
		expect(lists.create).toEqual([
			expect.objectContaining({ name: 'Action', type: 'mixed', imageAspect: 2 / 3 })
		]);
		expect(lists.skipped).toEqual(['Scifi']);

		const catalog = {
			key: 'test|movie|top',
			addonId: 'test',
			addonName: 'Test',
			type: 'movie' as const,
			catalogId: 'top',
			name: 'Top',
			genres: ['Action', 'Sci-Fi']
		};
		const genres = planImport(items, {
			mode: 'genre',
			catalog,
			libraries: [...libraries, { ...libraries[0], id: 'x', name: 'action' }]
		});
		expect(genres.restyle).toEqual([
			{ id: 'x', image: 'https://img.test/action.png', imageAspect: 2 / 3 }
		]);
		expect(genres.create[0].sources).toEqual([
			{ kind: 'catalog', addonId: 'test', type: 'movie', catalogId: 'top', genre: 'Sci-Fi' }
		]);
	});
});
