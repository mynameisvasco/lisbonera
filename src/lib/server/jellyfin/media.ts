import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import type { IdEntry } from '../ids';
import type { MediaRef, ShowProgress } from '../scrobble/types';
import { mediaKey } from '../scrobble/types';
import { playback, recentShows, showProgress, toMediaRef, watchedMovies } from '../scrobble/service';
import { BudgetExhausted, UpstreamError } from '../scope';
import { enabledLibraries, getAddon, listAddons, listCollectionItems, type Library } from '../store';
import { fetchCatalog, fetchMeta, isSearchable } from '../stremio/client';
import type { Meta, MetaPreview, Video } from '../stremio/types';
import type { JfContext } from './context';
import { episodeItem, movieItem, runtimeTicks, seasonItem, seriesItem, type UserState } from './dto';

/** Upper bound of items exposed per library; keeps full-library syncs (Infuse) inside the free plan. */
export const CATALOG_LIMIT = 500;

export type MediaType = 'movie' | 'series';

export interface Listed {
	meta: MetaPreview;
	type: MediaType;
}

export interface Page<T> {
	items: T[];
	total: number;
}

/**
 * Walks a Stremio catalog with `skip` until the requested window plus one look-ahead item is known.
 * `total` is exact once the catalog ends and a lower bound (more than the window) otherwise, which makes clients
 * request the next page without downloading the whole catalog up front.
 */
export async function paginate<T>(
	fetchPage: (skip: number) => Promise<T[]>,
	start: number,
	limit: number,
	options: { cap: number; key: (item: T) => string; all?: boolean }
): Promise<Page<T> & { complete: boolean }> {
	const items: T[] = [];
	const seen = new Set<string>();
	const want = options.all ? options.cap : Math.min(start + limit + 1, options.cap);
	let skip = 0;
	let firstPageSize = 0;
	let complete = false;

	while (items.length < want) {
		let page: T[];
		try {
			page = await fetchPage(skip);
		} catch (error) {
			if (items.length === 0 && !(error instanceof BudgetExhausted)) throw error;
			complete = true;
			break;
		}
		let added = 0;
		for (const item of page) {
			const key = options.key(item);
			if (seen.has(key)) continue;
			seen.add(key);
			items.push(item);
			added++;
		}
		// An empty page, a short page, or a page of repeats (addons that ignore `skip`) ends the catalog.
		if (page.length === 0 || added === 0) {
			complete = true;
			break;
		}
		if (firstPageSize === 0) firstPageSize = page.length;
		skip += page.length;
		if (page.length < firstPageSize) {
			complete = true;
			break;
		}
	}

	if (items.length >= options.cap) {
		items.length = options.cap;
		complete = true;
	}
	const window = limit > 0 ? items.slice(start, start + limit) : items.slice(start);
	return { items: window, total: items.length, complete };
}

export interface SeasonGroup {
	season: number;
	videos: (Video & { episode: number })[];
}

/** Groups episodes by season. Videos without a season or episode number cannot be addressed and are skipped. */
export function videosToSeasons(videos: Video[] | undefined): SeasonGroup[] {
	const groups = new Map<number, Map<number, Video & { episode: number }>>();
	for (const video of videos ?? []) {
		const season = video.season;
		const episode = video.episode ?? video.number;
		if (!Number.isInteger(season) || !Number.isInteger(episode)) continue;
		let group = groups.get(season!);
		if (!group) groups.set(season!, (group = new Map()));
		if (!group.has(episode!)) group.set(episode!, { ...video, episode: episode! });
	}
	return [...groups.entries()]
		.sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
		.map(([season, episodes]) => ({
			season,
			videos: [...episodes.values()].sort((a, b) => a.episode - b.episode)
		}));
}

export function asMediaType(type: string): MediaType | null {
	return type === 'movie' || type === 'series' ? type : null;
}

export async function loadMeta(c: JfContext, type: MediaType, stremioId: string): Promise<Meta | null> {
	try {
		return await fetchMeta(c, await listAddons(c.env.DB), type, stremioId);
	} catch (error) {
		if (error instanceof UpstreamError) return null;
		throw error;
	}
}

export function registerMeta(c: JfContext, meta: MetaPreview, type: MediaType): Promise<IdEntry> {
	return c.ids.register({
		kind: type,
		stremioId: meta.id,
		name: meta.name,
		poster: meta.poster ?? null,
		background: meta.background ?? null,
		logo: meta.logo ?? null,
		runtimeTicks: type === 'movie' ? runtimeTicks(meta.runtime) : null
	});
}

function movieState(watched: Set<string>, entry: IdEntry): UserState | undefined {
	const ref = toMediaRef(entry);
	if (!ref) return undefined;
	return { played: mediaKey(ref).some((key) => watched.has(key)) };
}

/** Builds list DTOs. Only movies get watched state here; per-show progress is fetched when a show is opened. */
export async function listItems(c: JfContext, listed: Listed[]): Promise<BaseItemDto[]> {
	const watched = listed.some((item) => item.type === 'movie') ? await watchedMovies(c) : new Set<string>();
	return Promise.all(
		listed.map(async ({ meta, type }) => {
			const entry = await registerMeta(c, meta, type);
			return type === 'movie'
				? movieItem(c.dto, entry, meta, movieState(watched, entry))
				: seriesItem(c.dto, entry, meta);
		})
	);
}

export interface SortSpec {
	by: string[];
	descending: boolean;
}

const SORTERS: Record<string, (a: MetaPreview, b: MetaPreview) => number> = {
	sortname: (a, b) => a.name.localeCompare(b.name),
	name: (a, b) => a.name.localeCompare(b.name),
	productionyear: (a, b) => Number(String(a.releaseInfo ?? 0).slice(0, 4)) - Number(String(b.releaseInfo ?? 0).slice(0, 4)),
	premieredate: (a, b) => Number(String(a.releaseInfo ?? 0).slice(0, 4)) - Number(String(b.releaseInfo ?? 0).slice(0, 4)),
	communityrating: (a, b) => Number(a.imdbRating ?? 0) - Number(b.imdbRating ?? 0)
};

/** Returns a comparator when the request asks for an order other than the catalog's own. */
export function sorter(sort: SortSpec): ((a: Listed, b: Listed) => number) | null {
	const keys = sort.by.map((key) => key.toLowerCase());
	if (keys.includes('random')) return () => Math.random() - 0.5;
	const comparators = keys.map((key) => SORTERS[key]).filter(Boolean);
	if (comparators.length === 0) return null;
	const direction = sort.descending ? -1 : 1;
	return (a, b) => {
		for (const compare of comparators) {
			const result = compare(a.meta, b.meta);
			if (result !== 0) return result * direction;
		}
		return 0;
	};
}

async function libraryFetcher(c: JfContext, library: Library): Promise<(skip: number) => Promise<Listed[]>> {
	if (library.kind === 'collection') {
		const items = await listCollectionItems(c.env.DB, library.id);
		const listed: Listed[] = items.map((item) => ({
			type: item.stremioType,
			meta: { id: item.stremioId, type: item.stremioType, name: item.name, poster: item.poster ?? undefined }
		}));
		return async (skip) => (skip === 0 ? listed : []);
	}
	const addon = library.addonId ? await getAddon(c.env.DB, library.addonId) : null;
	const type = asMediaType(library.catalogType);
	if (!addon?.enabled || !type || !library.catalogId) return async () => [];
	const catalogId = library.catalogId;
	return async (skip) =>
		(await fetchCatalog(c, addon, type, catalogId, skip > 0 ? { skip } : {})).map((meta) => ({ meta, type }));
}

export async function libraryPage(
	c: JfContext,
	library: Library,
	start: number,
	limit: number,
	options: { sort?: SortSpec; types?: MediaType[]; all?: boolean } = {}
): Promise<Page<Listed>> {
	const fetchPage = await libraryFetcher(c, library);
	const compare = options.sort ? sorter(options.sort) : null;
	const types = options.types ?? [];
	const filtering = library.catalogType === 'mixed' && types.length > 0;

	if (types.length > 0 && library.catalogType !== 'mixed' && !types.includes(library.catalogType)) {
		return { items: [], total: 0 };
	}
	if (!compare && !filtering) {
		return paginate(fetchPage, start, limit, {
			cap: CATALOG_LIMIT,
			key: (item) => item.meta.id,
			all: options.all
		});
	}
	const all = await paginate(fetchPage, 0, 0, { cap: CATALOG_LIMIT, key: (item) => item.meta.id, all: true });
	let items = types.length > 0 ? all.items.filter((item) => types.includes(item.type)) : all.items;
	if (compare) items = [...items].sort(compare);
	return { items: limit > 0 ? items.slice(start, start + limit) : items.slice(start), total: items.length };
}

/** Concatenates every enabled library of the requested types; used for library-wide queries without a parent. */
export async function allLibrariesPage(
	c: JfContext,
	types: MediaType[],
	start: number,
	limit: number,
	sort?: SortSpec
): Promise<Page<Listed>> {
	const libraries = (await enabledLibraries(c.env.DB)).filter(
		(library) => library.catalogType === 'mixed' || types.length === 0 || types.includes(library.catalogType)
	);
	const seen = new Set<string>();
	const items: Listed[] = [];
	for (const library of libraries) {
		const page = await libraryPage(c, library, 0, 0, { types, all: true });
		for (const item of page.items) {
			if (seen.has(item.meta.id)) continue;
			seen.add(item.meta.id);
			items.push(item);
		}
		if (c.budget.remaining < 5) break;
	}
	const compare = sort ? sorter(sort) : null;
	if (compare) items.sort(compare);
	return { items: limit > 0 ? items.slice(start, start + limit) : items.slice(start), total: items.length };
}

export async function search(c: JfContext, term: string, types: MediaType[], limit: number): Promise<Listed[]> {
	const addons = (await listAddons(c.env.DB)).filter((addon) => addon.enabled && addon.manifest);
	const targets = addons.flatMap((addon) =>
		addon
			.manifest!.catalogs.filter((catalog) => isSearchable(catalog))
			.map((catalog) => ({ addon, catalog, type: asMediaType(catalog.type) }))
			.filter((target): target is typeof target & { type: MediaType } =>
				target.type !== null && (types.length === 0 || types.includes(target.type))
			)
	);
	const results = await Promise.allSettled(
		targets.map(async ({ addon, catalog, type }) =>
			(await fetchCatalog(c, addon, type, catalog.id, { search: term })).map((meta) => ({ meta, type }))
		)
	);
	const seen = new Set<string>();
	const items: Listed[] = [];
	for (const result of results) {
		if (result.status !== 'fulfilled') continue;
		for (const item of result.value) {
			if (seen.has(item.meta.id)) continue;
			seen.add(item.meta.id);
			items.push(item);
		}
	}
	return items.slice(0, limit);
}

export interface SeriesView {
	entry: IdEntry;
	meta: Meta;
	seasons: { group: SeasonGroup; entry: IdEntry }[];
	progress: ShowProgress | null;
}

export async function loadSeries(c: JfContext, entry: IdEntry): Promise<SeriesView | null> {
	const meta = await loadMeta(c, 'series', entry.stremioId);
	if (!meta) return null;
	const series = await registerMeta(c, meta, 'series');
	const ref = toMediaRef(series);
	const [seasons, progress] = await Promise.all([
		Promise.all(
			videosToSeasons(meta.videos).map(async (group) => ({
				group,
				entry: await c.ids.register({
					kind: 'season',
					stremioId: series.stremioId,
					season: group.season,
					name: `${meta.name} ${group.season}`
				})
			}))
		),
		ref ? showProgress(c, ref) : Promise.resolve(null)
	]);
	return { entry: series, meta, seasons, progress };
}

export function seasonState(view: SeriesView, group: SeasonGroup): UserState | undefined {
	if (!view.progress) return undefined;
	const unplayed = group.videos.filter((video) => !view.progress!.watched.has(`${group.season}:${video.episode}`)).length;
	return { played: unplayed === 0, unplayed };
}

export function seriesState(view: SeriesView): UserState | undefined {
	if (!view.progress) return undefined;
	const states = view.seasons.filter((season) => season.group.season !== 0).map((season) => seasonState(view, season.group)!);
	const unplayed = states.reduce((sum, state) => sum + (state.unplayed ?? 0), 0);
	return { played: states.length > 0 && unplayed === 0, unplayed };
}

export function seriesDto(c: JfContext, view: SeriesView): BaseItemDto {
	return seriesItem(c.dto, view.entry, view.meta, seriesState(view), view.seasons.length);
}

export function seasonDtos(c: JfContext, view: SeriesView): BaseItemDto[] {
	return view.seasons.map(({ group, entry }) =>
		seasonItem(c.dto, entry, view.entry, view.meta.name, group.videos.length, seasonState(view, group))
	);
}

export async function episodeDtos(
	c: JfContext,
	view: SeriesView,
	season: number | null,
	progressByKey: Map<string, number> = new Map()
): Promise<BaseItemDto[]> {
	const seriesRuntime = runtimeTicks(view.meta.runtime);
	const groups = view.seasons.filter(({ group }) => season === null || group.season === season);
	const items: BaseItemDto[] = [];
	for (const { group, entry: seasonEntry } of groups) {
		for (const video of group.videos) {
			const episode = await c.ids.register({
				kind: 'episode',
				stremioId: view.entry.stremioId,
				season: group.season,
				episode: video.episode,
				videoId: video.id,
				name: video.name ?? video.title ?? null,
				poster: video.thumbnail ?? null,
				runtimeTicks: seriesRuntime
			});
			const key = `${group.season}:${video.episode}`;
			const state: UserState | undefined = view.progress
				? { played: view.progress.watched.has(key), progress: progressByKey.get(key) }
				: undefined;
			items.push(episodeItem(c.dto, episode, view.entry, view.meta.name, seasonEntry.guid, video, state));
		}
	}
	return items;
}

/** Progress of in-progress episodes for one show, keyed `${season}:${episode}`. */
export async function episodeProgress(c: JfContext, series: IdEntry): Promise<Map<string, number>> {
	const ref = toMediaRef(series);
	const map = new Map<string, number>();
	if (!ref) return map;
	for (const entry of await playback(c)) {
		if (entry.ref.type !== 'episode') continue;
		if ((ref.imdb && entry.ref.imdb === ref.imdb) || (ref.tmdb && entry.ref.tmdb === ref.tmdb)) {
			map.set(`${entry.ref.season}:${entry.ref.episode}`, entry.progress);
		}
	}
	return map;
}

function stremioIdOf(ref: MediaRef): string | null {
	if (ref.imdb) return ref.imdb;
	if (ref.tmdb) return `tmdb:${ref.tmdb}`;
	return null;
}

async function episodeFromRef(c: JfContext, ref: MediaRef, progress?: number): Promise<BaseItemDto | null> {
	const stremioId = stremioIdOf(ref);
	if (!stremioId || ref.season === undefined || ref.episode === undefined) return null;
	const series = await c.ids.register({ kind: 'series', stremioId });
	const view = await loadSeries(c, series);
	if (!view) return null;
	const items = await episodeDtos(c, view, ref.season, progress !== undefined ? new Map([[`${ref.season}:${ref.episode}`, progress]]) : undefined);
	return items.find((item) => item.IndexNumber === ref.episode) ?? null;
}

/** "Continue watching" from the active scrobble provider. */
export async function resumeItems(c: JfContext, limit: number, types: MediaType[]): Promise<BaseItemDto[]> {
	const entries = (await playback(c)).filter((entry) =>
		types.length === 0 ? true : types.includes(entry.ref.type === 'movie' ? 'movie' : 'series')
	);
	const items: BaseItemDto[] = [];
	for (const entry of entries) {
		if (items.length >= limit || c.budget.remaining < 3) break;
		if (entry.ref.type === 'movie') {
			const stremioId = stremioIdOf(entry.ref);
			const meta = stremioId ? await loadMeta(c, 'movie', stremioId) : null;
			if (!meta) continue;
			const movie = await registerMeta(c, meta, 'movie');
			items.push(movieItem(c.dto, movie, meta, { played: false, progress: entry.progress }));
		} else {
			const item = await episodeFromRef(c, entry.ref, entry.progress);
			if (item) items.push(item);
		}
	}
	return items;
}

/** "Next up": the next unwatched episode of recently watched shows, or of one show when `seriesId` is given. */
export async function nextUpItems(c: JfContext, limit: number, series?: IdEntry): Promise<BaseItemDto[]> {
	const shows: MediaRef[] = series ? [toMediaRef(series)].filter((ref): ref is MediaRef => ref !== null) : await recentShows(c, limit);
	const items: BaseItemDto[] = [];
	for (const show of shows) {
		if (items.length >= limit || c.budget.remaining < 3) break;
		const progress = await showProgress(c, show);
		if (!progress?.next) continue;
		const item = await episodeFromRef(c, { ...show, type: 'episode', season: progress.next.season, episode: progress.next.episode });
		if (item) items.push(item);
	}
	return items;
}

/** Single-item DTO for any registered id. */
export async function itemDto(c: JfContext, entry: IdEntry): Promise<BaseItemDto | null> {
	if (entry.kind === 'movie') {
		const meta = await loadMeta(c, 'movie', entry.stremioId);
		const fallback: MetaPreview = { id: entry.stremioId, type: 'movie', name: entry.name ?? entry.stremioId };
		const movie = meta ? await registerMeta(c, meta, 'movie') : entry;
		const [watched, inProgress] = await Promise.all([watchedMovies(c), playback(c)]);
		const ref = toMediaRef(movie);
		const progress = ref
			? inProgress.find((item) => item.ref.type === 'movie' && mediaKey(item.ref).some((key) => mediaKey(ref).includes(key)))?.progress
			: undefined;
		const state = movieState(watched, movie);
		return movieItem(c.dto, movie, meta ?? fallback, state ? { ...state, progress } : undefined);
	}

	const series = entry.kind === 'series' ? entry : await c.ids.register({ kind: 'series', stremioId: entry.stremioId });
	const view = await loadSeries(c, series);
	if (!view) return null;
	if (entry.kind === 'series') return seriesDto(c, view);
	if (entry.kind === 'season') return seasonDtos(c, view).find((item) => item.IndexNumber === entry.season) ?? null;
	const progress = await episodeProgress(c, view.entry);
	const episodes = await episodeDtos(c, view, entry.season, progress);
	return episodes.find((item) => item.Id === entry.guid) ?? null;
}
