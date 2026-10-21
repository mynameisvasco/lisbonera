import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { addCollectionItem, createCollection, invalidateConfig } from '../src/lib/server/store';
import {
	ADDON_URL,
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

interface Item {
	Id: string;
	Name: string;
	Type: string;
	IndexNumber?: number;
	ParentIndexNumber?: number;
	SeriesId?: string;
	SeasonId?: string;
	ImageTags?: Record<string, string>;
	Path?: string;
	ServerId?: string;
	UserData?: { Played: boolean };
}

interface Result {
	Items: Item[];
	TotalRecordCount: number;
	StartIndex: number;
}

let token: string;

beforeEach(async () => {
	await seed();
	mockAddon();
	token = await login();
});

describe('libraries', () => {
	it('lists enabled libraries as collection folders', async () => {
		const views = await getJson<Result>('/UserViews', token);
		expect(views.Items.map((item) => [item.Name, item.Type])).toEqual([
			['Top Movies', 'CollectionFolder'],
			['Shows', 'CollectionFolder']
		]);
	});

	it('pages a catalog with a look-ahead total (camelCase query, as Infuse sends it)', async () => {
		const first = await getJson<Result>(
			`/Users/me/Items?parentId=${LIBRARY_ID}&startIndex=0&limit=2`,
			token
		);
		expect(first.Items.map((item) => item.Name)).toEqual(['Alpha', 'Bravo']);
		expect(first.TotalRecordCount).toBe(3);

		const second = await getJson<Result>(
			`/Items?ParentId=${LIBRARY_ID}&StartIndex=2&Limit=2`,
			token
		);
		expect(second.Items.map((item) => item.Name)).toEqual(['Charlie']);
		expect(second.TotalRecordCount).toBe(3);
		expect(second.StartIndex).toBe(2);
	});

	it('returns DTOs that strict clients can parse', async () => {
		const { Items } = await getJson<Result>(`/Items?ParentId=${LIBRARY_ID}&Limit=1`, token);
		const [movie] = Items;
		expect(movie.Id).toMatch(/^[0-9a-f]{32}$/);
		expect(movie.ServerId).toMatch(/^[0-9a-f]{32}$/);
		expect(movie.Type).toBe('Movie');
		expect(movie.Path).toBe('Alpha (2001)');
		expect(movie.ImageTags?.Primary).toBeTruthy();
		expect(movie.UserData?.Played).toBe(false);
	});

	it('sorts by explicit keys only', async () => {
		const result = await getJson<Result>(
			`/Items?ParentId=${LIBRARY_ID}&SortBy=ProductionYear&SortOrder=Descending&Limit=10`,
			token
		);
		expect(result.Items.map((item) => item.Name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
	});

	it('lists every library of a type without a parent', async () => {
		const result = await getJson<Result>(
			'/Items?IncludeItemTypes=Movie&Recursive=true&Limit=10',
			token
		);
		expect(result.Items).toHaveLength(3);
		const episodes = await getJson<Result>('/Items?IncludeItemTypes=Episode&Recursive=true', token);
		expect(episodes.Items).toEqual([]);
	});

	it('returns latest items as an array', async () => {
		const latest = await getJson<Item[]>(`/Items/Latest?ParentId=${LIBRARY_ID}&Limit=2`, token);
		expect(latest.map((item) => item.Name)).toEqual(['Alpha', 'Bravo']);
	});
});

describe('series', () => {
	async function seriesId() {
		const { Items } = await getJson<Result>(`/Items?ParentId=${SHOWS_LIBRARY_ID}`, token);
		return Items[0].Id;
	}

	it('lists seasons and episodes with stable relationships', async () => {
		const id = await seriesId();
		const seasons = await getJson<Result>(`/Shows/${id}/Seasons`, token);
		expect(seasons.Items.map((season) => season.Name)).toEqual([
			'Season 1',
			'Season 2',
			'Specials'
		]);

		const season1 = seasons.Items[0];
		const episodes = await getJson<Result>(`/Shows/${id}/Episodes?SeasonId=${season1.Id}`, token);
		expect(
			episodes.Items.map((episode) => [
				episode.ParentIndexNumber,
				episode.IndexNumber,
				episode.Name
			])
		).toEqual([
			[1, 1, 'First'],
			[1, 2, 'Second']
		]);
		for (const episode of episodes.Items) {
			expect(episode.SeriesId).toBe(id);
			expect(episode.SeasonId).toBe(season1.Id);
		}

		const viaParent = await getJson<Result>(`/Items?ParentId=${season1.Id}`, token);
		expect(viaParent.Items.map((episode) => episode.Id)).toEqual(
			episodes.Items.map((episode) => episode.Id)
		);
	});

	it('resolves every id it hands out', async () => {
		const id = await seriesId();
		const seasons = await getJson<Result>(`/Shows/${id}/Seasons`, token);
		const episodes = await getJson<Result>(`/Shows/${id}/Episodes`, token);
		for (const item of [...seasons.Items, ...episodes.Items]) {
			const detail = await getJson<Item>(`/Users/me/Items/${item.Id}`, token);
			expect(detail.Id).toBe(item.Id);
		}
		const series = await getJson<Item>(`/Items/${id}`, token);
		expect(series.Type).toBe('Series');
	});
});

describe('search', () => {
	it('searches catalogs that support it', async () => {
		const result = await getJson<Result>(
			'/Items?SearchTerm=bra&IncludeItemTypes=Movie,Series&Recursive=true',
			token
		);
		expect(result.Items.map((item) => item.Name)).toEqual(['Bravo']);
		const hints = await getJson<{ SearchHints: { Name: string }[] }>(
			'/Search/Hints?SearchTerm=alp',
			token
		);
		expect(hints.SearchHints.map((hint) => hint.Name)).toEqual(['Alpha']);
	});
});

describe('images', () => {
	it('proxies images without authentication', async () => {
		const { Items } = await getJson<Result>(`/Items?ParentId=${LIBRARY_ID}&Limit=1`, token);
		const { http, HttpResponse } = await import('msw');
		const { network } = await import('./network');
		network.use(
			http.get(
				'https://img.test/1.jpg',
				() => new HttpResponse('jpeg', { headers: { 'content-type': 'image/jpeg' } })
			)
		);
		const response = await call(`/Items/${Items[0].Id}/Images/Primary?maxWidth=300`);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toContain('immutable');
		expect(await response.text()).toBe('jpeg');
		expect((await call(`/Items/${Items[0].Id}/Images/Logo`, authed(token))).status).toBe(404);
	});
});

describe('client defaults and failures', () => {
	it('keeps the source order under the SortName default clients send', async () => {
		const result = await getJson<Result>(
			`/Items?ParentId=${LIBRARY_ID}&SortBy=SortName&SortOrder=Ascending`,
			token
		);
		expect(result.Items.map((item) => item.Name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
	});

	it('keeps the order set for a collection', async () => {
		const id = await createCollection(env.DB, 'Picks', 'movie');
		for (const [stremioId, name] of [
			['tt0000003', 'Charlie'],
			['tt0000001', 'Alpha']
		]) {
			await addCollectionItem(env.DB, {
				libraryId: id,
				stremioType: 'movie',
				stremioId,
				name,
				poster: null
			});
		}
		invalidateConfig();
		const result = await getJson<Result>(
			`/Items?ParentId=${id}&SortBy=SortName,ProductionYear`,
			token
		);
		expect(result.Items.map((item) => item.Name)).toEqual(['Charlie', 'Alpha']);
	});

	it('filters a library by NameStartsWith instead of searching', async () => {
		const result = await getJson<Result>(`/Items?ParentId=${LIBRARY_ID}&NameStartsWith=b`, token);
		expect(result.Items.map((item) => item.Name)).toEqual(['Bravo']);
	});

	it('returns nothing for favorites', async () => {
		const result = await getJson<Result>(
			'/Items?Filters=IsFavorite&Recursive=true&IncludeItemTypes=Movie',
			token
		);
		expect(result.Items).toEqual([]);
	});

	it('serves other libraries when one catalog fails', async () => {
		network.use(
			http.get(`${ADDON_URL}/catalog/movie/top.json`, () => HttpResponse.json({}, { status: 503 }))
		);
		const failing = await call(`/Items?ParentId=${LIBRARY_ID}`, authed(token));
		expect(failing.status).toBe(200);
		expect(((await failing.json()) as Result).Items).toEqual([]);

		const all = await getJson<Result>('/Items?Recursive=true&IncludeItemTypes=Movie,Series', token);
		expect(all.Items.map((item) => item.Name)).toEqual(['Delta']);
		const latest = await getJson<Item[]>('/Items/Latest', token);
		expect(latest.map((item) => item.Name)).toEqual(['Delta']);
	});
});
