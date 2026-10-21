import type { PackShape } from '../../packs';
import { SHAPE_ASPECT } from '../../shapes';
import type { GenreCatalog } from './collections';
import { fetchJson, type Scope, UpstreamError } from '../scope';
import type { CollectionSource, Library, LibraryType } from '../store';

const PACK_TTL = 6 * 3600;

export class PackError extends Error {}

export interface PackList {
	user: string;
	slug: string;
	name: string;
}

export interface PackItem {
	name: string;
	image: string;
	shape: PackShape;
	lists: PackList[];
}

interface FusionList {
	kind?: string;
	payload?: { username?: string; listSlug?: string; listName?: string };
}

interface FusionCollection {
	name?: string;
	title?: string;
	backgroundImageURL?: string;
	imageURL?: string;
	layout?: string;
	imageAspect?: string;
	dataSources?: FusionList[];
	dataSource?: FusionList;
}

function shapeOf(value: string | undefined): PackShape {
	const lower = value?.toLowerCase();
	return lower === 'wide' ? 'wide' : lower === 'square' ? 'square' : 'poster';
}

function listsOf(collection: FusionCollection): PackList[] {
	const sources = collection.dataSources ?? (collection.dataSource ? [collection.dataSource] : []);
	return sources.flatMap((source) => {
		const payload = source.payload;
		if (source.kind !== 'traktList' || !payload?.username || !payload.listSlug) return [];
		return [
			{ user: payload.username, slug: payload.listSlug, name: payload.listName ?? payload.listSlug }
		];
	});
}

/** Reads Fusion collection exports (`[{ name, backgroundImageURL, layout }]`) and widget exports. */
export function parsePack(body: unknown): PackItem[] {
	const widgets = (body as { widgets?: { dataSource?: { payload?: { items?: unknown[] } } }[] })
		?.widgets;
	const raw: FusionCollection[] = Array.isArray(body)
		? body
		: Array.isArray(widgets)
			? widgets.flatMap((widget) => (widget.dataSource?.payload?.items ?? []) as FusionCollection[])
			: [];
	return raw.flatMap((collection) => {
		const name = (collection.name ?? collection.title ?? '').trim().slice(0, 80);
		const image = collection.backgroundImageURL ?? collection.imageURL ?? '';
		if (!name || !/^https:\/\/\S+$/i.test(image)) return [];
		return [
			{
				name,
				image,
				shape: shapeOf(collection.layout ?? collection.imageAspect),
				lists: listsOf(collection)
			}
		];
	});
}

export async function loadPack(scope: Scope, url: string): Promise<PackItem[]> {
	if (!/^https:\/\/\S+$/i.test(url)) throw new PackError('Enter an https URL to a pack JSON file');
	let body: unknown;
	try {
		body = await fetchJson<unknown>(scope, url, { ttl: PACK_TTL, timeoutMs: 8000 });
	} catch (error) {
		throw new PackError(
			error instanceof UpstreamError
				? `Could not load the pack: ${error.message}`
				: 'Could not load the pack'
		);
	}
	const items = parsePack(body);
	if (items.length === 0) throw new PackError('No collections with artwork in that file');
	return items;
}

/** Lower-case letters and digits only, with the spellings packs and addons disagree on folded together. */
export function normalizeName(value: string): string {
	const plain = value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]/g, '');
	const aliases: Record<string, string> = {
		scifi: 'sciencefiction',
		docs: 'documentary',
		documentaries: 'documentary',
		kids: 'family',
		anime: 'animation'
	};
	return aliases[plain] ?? plain;
}

/** The catalog genre a pack item stands for, by name. */
export function matchGenre(name: string, genres: string[]): string | null {
	const target = normalizeName(name);
	const exact = genres.find((genre) => normalizeName(genre) === target);
	if (exact) return exact;
	if (target.length < 4) return null;
	return (
		genres.find((genre) => {
			const candidate = normalizeName(genre);
			return candidate.startsWith(target) || target.startsWith(candidate);
		}) ?? null
	);
}

/** Lists in packs are named "… Movies" / "… Shows"; anything else is treated as mixed. */
function typeOfLists(lists: PackList[]): LibraryType {
	const words = lists.map((list) => `${list.name} ${list.slug}`.toLowerCase());
	const shows = words.filter((text) => /\b(shows?|series|tv)\b/.test(text)).length;
	const movies = words.filter((text) => /\b(movies?|films?)\b/.test(text)).length;
	if (shows === lists.length) return 'series';
	if (movies === lists.length) return 'movie';
	return 'mixed';
}

export type PackSourceMode = 'lists' | 'genre' | 'none';

export interface PackPlan {
	create: {
		name: string;
		type: LibraryType;
		sources: CollectionSource[];
		image: string;
		imageAspect: number;
	}[];
	/** Existing libraries with the same name that only get the artwork. */
	restyle: { id: string; image: string; imageAspect: number }[];
	skipped: string[];
}

/** Decides, per selected item, whether it becomes a new collection, restyles a library, or is skipped. */
export function planImport(
	items: PackItem[],
	options: { mode: PackSourceMode; catalog: GenreCatalog | null; libraries: Library[] }
): PackPlan {
	const plan: PackPlan = { create: [], restyle: [], skipped: [] };
	const existing = new Map(
		options.libraries.map((library) => [normalizeName(library.name), library])
	);
	for (const item of items) {
		const imageAspect = SHAPE_ASPECT[item.shape];
		const match = existing.get(normalizeName(item.name));
		if (match) {
			plan.restyle.push({ id: match.id, image: item.image, imageAspect });
			continue;
		}
		if (options.mode === 'lists') {
			if (item.lists.length === 0) {
				plan.skipped.push(item.name);
				continue;
			}
			plan.create.push({
				name: item.name,
				type: typeOfLists(item.lists),
				sources: item.lists.map((list) => ({ kind: 'trakt', ...list })),
				image: item.image,
				imageAspect
			});
		} else if (options.mode === 'genre') {
			const catalog = options.catalog;
			const genre = catalog ? matchGenre(item.name, catalog.genres) : null;
			if (!catalog || !genre) {
				plan.skipped.push(item.name);
				continue;
			}
			plan.create.push({
				name: item.name,
				type: catalog.type,
				sources: [
					{
						kind: 'catalog',
						addonId: catalog.addonId,
						type: catalog.type,
						catalogId: catalog.catalogId,
						genre
					}
				],
				image: item.image,
				imageAspect
			});
		} else {
			plan.create.push({
				name: item.name,
				type: 'mixed',
				sources: [],
				image: item.image,
				imageAspect
			});
		}
	}
	return plan;
}
