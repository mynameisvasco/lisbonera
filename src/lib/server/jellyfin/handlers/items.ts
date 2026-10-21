import type { BaseItemDto, SearchHint } from '@jellyfin/sdk/lib/generated-client/models';
import { json, notFound } from '../../http';
import { enabledLibraries, getLibrary } from '../../store';
import type { JfContext } from '../context';
import { libraryItem, mediaSource } from '../dto';
import {
	allLibrariesPage,
	episodeDtos,
	episodeProgress,
	itemDto,
	libraryPage,
	listItems,
	loadSeries,
	nextUpItems,
	resumeItems,
	search,
	seasonDtos,
	type MediaType,
	type SortSpec
} from '../media';
import type { Router } from '../router';
import { resolveSources } from '../streams';

const DEFAULT_LIMIT = 100;

function result(items: BaseItemDto[], total = items.length, start = 0): Response {
	return json({ Items: items, TotalRecordCount: total, StartIndex: start });
}

const emptyResult = () => result([]);

interface TypeFilter {
	media: MediaType[];
	/** Requested only item kinds this server cannot list on their own (episodes, people, music…). */
	unsupported: boolean;
}

function typeFilter(c: JfContext): TypeFilter {
	const requested = c.query.list('IncludeItemTypes').map((type) => type.toLowerCase());
	const media: MediaType[] = [];
	if (requested.includes('movie')) media.push('movie');
	if (requested.includes('series')) media.push('series');
	return { media, unsupported: requested.length > 0 && media.length === 0 };
}

function sortSpec(c: JfContext): SortSpec {
	return { by: c.query.list('SortBy'), descending: c.query.get('SortOrder')?.toLowerCase() === 'descending' };
}

async function views(c: JfContext): Promise<BaseItemDto[]> {
	return (await enabledLibraries(c.env.DB)).map((library) => libraryItem(c.dto, library));
}

async function childrenOf(c: JfContext, parentId: string, types: TypeFilter): Promise<Response> {
	const start = c.query.int('StartIndex', 0);
	const limit = c.query.int('Limit', DEFAULT_LIMIT);

	const library = await getLibrary(c.env.DB, parentId);
	if (library) {
		if (types.unsupported) return emptyResult();
		const page = await libraryPage(c, library, start, limit, { sort: sortSpec(c), types: types.media });
		return result(await listItems(c, page.items), page.total, start);
	}

	const entry = await c.ids.resolve(parentId);
	if (!entry || entry.kind === 'movie' || entry.kind === 'episode') return emptyResult();
	const series = entry.kind === 'series' ? entry : await c.ids.register({ kind: 'series', stremioId: entry.stremioId });
	const view = await loadSeries(c, series);
	if (!view) return emptyResult();

	const wantsEpisodes = c.query.list('IncludeItemTypes').some((type) => type.toLowerCase() === 'episode');
	const items =
		entry.kind === 'season' || wantsEpisodes
			? await episodeDtos(c, view, entry.kind === 'season' ? entry.season : null, await episodeProgress(c, series))
			: seasonDtos(c, view);
	return result(limit > 0 ? items.slice(start, start + limit) : items.slice(start), items.length, start);
}

async function queryItems(c: JfContext): Promise<Response> {
	const start = c.query.int('StartIndex', 0);
	const limit = c.query.int('Limit', DEFAULT_LIMIT);
	const types = typeFilter(c);

	const ids = c.query.list('Ids');
	if (ids.length > 0) {
		const items = await Promise.all(ids.map((id) => lookup(c, id.toLowerCase().replace(/-/g, ''))));
		return result(items.filter((item): item is BaseItemDto => item !== null));
	}

	if (c.query.list('Filters').some((filter) => filter.toLowerCase() === 'isresumable')) {
		return result(await resumeItems(c, limit || 12, types.media));
	}

	const term = c.query.get('SearchTerm') ?? c.query.get('NameStartsWith');
	if (term) {
		if (types.unsupported) return emptyResult();
		const found = await search(c, term, types.media, limit || 50);
		return result(await listItems(c, found));
	}

	const parentId = c.query.get('ParentId');
	if (parentId) return childrenOf(c, parentId.toLowerCase().replace(/-/g, ''), types);

	if (types.media.length > 0 || c.query.bool('Recursive')) {
		if (types.unsupported) return emptyResult();
		const page = await allLibrariesPage(c, types.media, start, limit, sortSpec(c));
		return result(await listItems(c, page.items), page.total, start);
	}

	return result(await views(c));
}

/** Resolves any id this server hands out: libraries first, then mapped Stremio items. */
async function lookup(c: JfContext, id: string): Promise<BaseItemDto | null> {
	const library = await getLibrary(c.env.DB, id);
	if (library) return libraryItem(c.dto, library);
	const entry = await c.ids.resolve(id);
	return entry ? itemDto(c, entry) : null;
}

async function itemDetail(c: JfContext): Promise<Response> {
	const id = c.params.itemId.replace(/-/g, '');
	const item = await lookup(c, id);
	if (!item) return notFound();
	// Clients show versions from the item itself; the list is cached and reused by PlaybackInfo and the stream redirect.
	if (item.Type === 'Movie' || item.Type === 'Episode') {
		const entry = await c.ids.resolve(id);
		if (entry) {
			const sources = await resolveSources(c, entry);
			item.MediaSources = sources.map((source) => mediaSource(source, item.Path ?? item.Name ?? '', item.RunTimeTicks ?? null));
		}
	}
	return json(item);
}

async function latest(c: JfContext): Promise<Response> {
	const limit = c.query.int('Limit', 16) || 16;
	const types = typeFilter(c);
	if (types.unsupported) return json([]);
	const parentId = c.query.get('ParentId')?.toLowerCase().replace(/-/g, '');
	const library = parentId ? await getLibrary(c.env.DB, parentId) : null;
	const page = library
		? await libraryPage(c, library, 0, limit, { types: types.media })
		: await allLibrariesPage(c, types.media, 0, limit);
	return json(await listItems(c, page.items));
}

async function seasons(c: JfContext): Promise<Response> {
	const entry = await c.ids.resolve(c.params.seriesId.replace(/-/g, ''));
	if (!entry || entry.kind !== 'series') return emptyResult();
	const view = await loadSeries(c, entry);
	return result(view ? seasonDtos(c, view) : []);
}

async function episodes(c: JfContext): Promise<Response> {
	const entry = await c.ids.resolve(c.params.seriesId.replace(/-/g, ''));
	if (!entry || entry.kind !== 'series') return emptyResult();
	const view = await loadSeries(c, entry);
	if (!view) return emptyResult();

	let season: number | null = null;
	const seasonId = c.query.get('SeasonId')?.toLowerCase().replace(/-/g, '');
	if (seasonId) season = (await c.ids.resolve(seasonId))?.season ?? null;
	else if (c.query.get('Season') !== undefined) season = c.query.int('Season', 1);

	const items = await episodeDtos(c, view, season, await episodeProgress(c, entry));
	const start = c.query.int('StartIndex', 0);
	const limit = c.query.int('Limit', 0);
	const startItemId = c.query.get('StartItemId')?.toLowerCase().replace(/-/g, '');
	const from = startItemId ? Math.max(0, items.findIndex((item) => item.Id === startItemId)) : start;
	return result(limit > 0 ? items.slice(from, from + limit) : items.slice(from), items.length, from);
}

async function nextUp(c: JfContext): Promise<Response> {
	const limit = c.query.int('Limit', 12) || 12;
	const seriesId = c.query.get('SeriesId')?.toLowerCase().replace(/-/g, '');
	const series = seriesId ? await c.ids.resolve(seriesId) : null;
	if (seriesId && series?.kind !== 'series') return emptyResult();
	return result(await nextUpItems(c, limit, series ?? undefined));
}

async function searchHints(c: JfContext): Promise<Response> {
	const term = c.query.get('SearchTerm');
	const types = typeFilter(c);
	if (!term || types.unsupported) return json({ SearchHints: [], TotalRecordCount: 0 });
	const items = await listItems(c, await search(c, term, types.media, c.query.int('Limit', 20) || 20));
	const hints: SearchHint[] = items.map((item) => ({
		ItemId: item.Id,
		Id: item.Id,
		Name: item.Name ?? '',
		ProductionYear: item.ProductionYear,
		PrimaryImageTag: item.ImageTags?.Primary,
		PrimaryImageAspectRatio: item.PrimaryImageAspectRatio,
		Type: item.Type,
		IsFolder: item.IsFolder,
		RunTimeTicks: item.RunTimeTicks,
		MediaType: item.MediaType
	}));
	return json({ SearchHints: hints, TotalRecordCount: hints.length });
}

async function counts(c: JfContext): Promise<Response> {
	const libraries = await enabledLibraries(c.env.DB);
	return json({
		MovieCount: libraries.filter((library) => library.catalogType === 'movie').length,
		SeriesCount: libraries.filter((library) => library.catalogType === 'series').length,
		EpisodeCount: 0,
		ArtistCount: 0,
		ProgramCount: 0,
		TrailerCount: 0,
		SongCount: 0,
		AlbumCount: 0,
		MusicVideoCount: 0,
		BoxSetCount: 0,
		BookCount: 0,
		ItemCount: libraries.length
	});
}

export function itemRoutes(router: Router): void {
	router.on('GET', ['/userviews', '/users/:userId/views', '/library/mediafolders'], async (c) => result(await views(c)));
	router.on('GET', '/library/virtualfolders', async (c) =>
		json(
			(await views(c)).map((view) => ({
				Name: view.Name,
				Locations: [],
				CollectionType: view.CollectionType,
				ItemId: view.Id,
				LibraryOptions: {}
			}))
		)
	);
	router.on('GET', ['/users/:userId/groupingoptions', '/userviews/groupingoptions'], () => json([]));

	router.on('GET', ['/items/latest', '/users/:userId/items/latest'], latest);
	router.on('GET', ['/items/resume', '/users/:userId/items/resume', '/useritems/resume'], async (c) =>
		result(await resumeItems(c, c.query.int('Limit', 12) || 12, typeFilter(c).media))
	);
	router.on('GET', '/items/counts', counts);
	router.on('GET', ['/items/filters', '/items/filters2'], () =>
		json({ Genres: [], Tags: [], OfficialRatings: [], Years: [] })
	);
	router.on('GET', ['/items', '/users/:userId/items'], queryItems);
	router.on('GET', ['/items/:itemId', '/users/:userId/items/:itemId'], itemDetail);

	router.on('GET', '/shows/nextup', nextUp);
	router.on('GET', '/shows/:seriesId/seasons', seasons);
	router.on('GET', '/shows/:seriesId/episodes', episodes);
	router.on('GET', '/search/hints', searchHints);

	router.on(
		'GET',
		[
			'/items/:itemId/similar',
			'/movies/:itemId/similar',
			'/shows/:itemId/similar',
			'/items/:itemId/intros',
			'/users/:userId/items/:itemId/intros',
			'/mediasegments/:itemId',
			'/genres',
			'/studios',
			'/persons'
		],
		emptyResult
	);
	router.on(
		'GET',
		[
			'/items/:itemId/localtrailers',
			'/users/:userId/items/:itemId/localtrailers',
			'/items/:itemId/specialfeatures',
			'/users/:userId/items/:itemId/specialfeatures',
			'/items/:itemId/ancestors',
			'/sessions'
		],
		() => json([])
	);
	router.on('GET', '/items/:itemId/thememedia', (c) => {
		const empty = { Items: [], TotalRecordCount: 0, StartIndex: 0, OwnerId: c.params.itemId };
		return json({ ThemeVideosResult: empty, ThemeSongsResult: empty, SoundtrackSongsResult: empty });
	});
}
