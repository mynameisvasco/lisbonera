import { randomHex } from './crypto';
import { memo } from './scope';
import type { Addon, Manifest } from './stremio/types';

const CONFIG_TTL = 30 * 1000;

export type LibraryType = 'movie' | 'series' | 'mixed';

/**
 * Where a collection's titles come from. A collection without sources is a hand-picked list; with several, their
 * titles are listed one source after the other (a pack's movie list, then its show list).
 */
export type CollectionSource =
	| {
			kind: 'catalog';
			addonId: string;
			type: 'movie' | 'series';
			catalogId: string;
			genre?: string;
	  }
	| { kind: 'mdblist'; list: string }
	| { kind: 'trakt'; user: string; slug: string; name?: string };

export interface Library {
	id: string;
	kind: 'catalog' | 'collection';
	addonId: string | null;
	catalogType: LibraryType;
	catalogId: string | null;
	name: string;
	enabled: boolean;
	position: number;
	sources: CollectionSource[];
	/** An http(s) URL, or `upload:<id>` for artwork stored in the `images` table. */
	image: string | null;
	/** Width divided by height of `image`, when known. */
	imageAspect: number | null;
}

export interface CollectionItem {
	libraryId: string;
	stremioType: 'movie' | 'series';
	stremioId: string;
	name: string;
	poster: string | null;
	position: number;
}

interface AddonRow {
	id: string;
	url: string;
	manifest: string | null;
	enabled: number;
	position: number;
	last_error: string | null;
	checked_at: number | null;
}

interface LibraryRow {
	id: string;
	kind: 'catalog' | 'collection';
	addon_id: string | null;
	catalog_type: LibraryType;
	catalog_id: string | null;
	name: string;
	enabled: number;
	position: number;
	sources: string | null;
	image: string | null;
	image_aspect: number | null;
}

interface CollectionItemRow {
	library_id: string;
	stremio_type: 'movie' | 'series';
	stremio_id: string;
	name: string;
	poster: string | null;
	position: number;
}

function parseManifest(raw: string | null): Manifest | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Manifest;
	} catch {
		return null;
	}
}

function toAddon(row: AddonRow): Addon {
	return {
		id: row.id,
		url: row.url,
		manifest: parseManifest(row.manifest),
		enabled: row.enabled === 1,
		position: row.position,
		lastError: row.last_error,
		checkedAt: row.checked_at
	};
}

function parseSources(raw: string | null): CollectionSource[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as CollectionSource | CollectionSource[];
		return Array.isArray(parsed) ? parsed : [parsed];
	} catch {
		return [];
	}
}

function toLibrary(row: LibraryRow): Library {
	return {
		id: row.id,
		kind: row.kind,
		addonId: row.addon_id,
		catalogType: row.catalog_type,
		catalogId: row.catalog_id,
		name: row.name,
		enabled: row.enabled === 1,
		position: row.position,
		sources: parseSources(row.sources),
		image: row.image,
		imageAspect: row.image_aspect
	};
}

/** Configuration changes in the dashboard call this so the API sees them immediately in the same isolate. */
export function invalidateConfig(): void {
	memo.delete('config:addons');
	memo.delete('config:libraries');
}

export async function listAddons(db: D1Database): Promise<Addon[]> {
	const cached = memo.get<Addon[]>('config:addons', CONFIG_TTL);
	if (cached?.fresh) return cached.value;
	const { results } = await db
		.prepare('SELECT * FROM addons ORDER BY position, id')
		.all<AddonRow>();
	const addons = results.map(toAddon);
	memo.set('config:addons', addons);
	return addons;
}

export async function getAddon(db: D1Database, id: string): Promise<Addon | null> {
	return (await listAddons(db)).find((addon) => addon.id === id) ?? null;
}

export async function insertAddon(
	db: D1Database,
	url: string,
	manifest: Manifest
): Promise<string> {
	const id = randomHex(8);
	await db
		.prepare(
			`INSERT INTO addons (id, url, manifest, enabled, position, checked_at)
			VALUES (?, ?, ?, 1, (SELECT coalesce(max(position), -1) + 1 FROM addons), ?)`
		)
		.bind(id, url, JSON.stringify(manifest), Date.now())
		.run();
	invalidateConfig();
	return id;
}

export async function updateAddonManifest(
	db: D1Database,
	id: string,
	manifest: Manifest
): Promise<void> {
	await db
		.prepare('UPDATE addons SET manifest = ?, last_error = NULL, checked_at = ? WHERE id = ?')
		.bind(JSON.stringify(manifest), Date.now(), id)
		.run();
	invalidateConfig();
}

export async function setAddonError(db: D1Database, id: string, message: string): Promise<void> {
	await db
		.prepare('UPDATE addons SET last_error = ?, checked_at = ? WHERE id = ?')
		.bind(message.slice(0, 500), Date.now(), id)
		.run();
	invalidateConfig();
}

export async function setAddonEnabled(db: D1Database, id: string, enabled: boolean): Promise<void> {
	await db
		.prepare('UPDATE addons SET enabled = ? WHERE id = ?')
		.bind(enabled ? 1 : 0, id)
		.run();
	invalidateConfig();
}

export async function deleteAddon(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM addons WHERE id = ?').bind(id).run();
	invalidateConfig();
}

/** Rewrites `position` for the given table so it follows the order of `ids`. */
export async function reorder(
	db: D1Database,
	table: 'addons' | 'libraries',
	ids: string[]
): Promise<void> {
	if (ids.length === 0) return;
	await db.batch(
		ids.map((id, position) =>
			db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).bind(position, id)
		)
	);
	invalidateConfig();
}

export async function listLibraries(db: D1Database): Promise<Library[]> {
	const cached = memo.get<Library[]>('config:libraries', CONFIG_TTL);
	if (cached?.fresh) return cached.value;
	const { results } = await db
		.prepare('SELECT * FROM libraries ORDER BY position, name')
		.all<LibraryRow>();
	const libraries = results.map(toLibrary);
	memo.set('config:libraries', libraries);
	return libraries;
}

export async function enabledLibraries(db: D1Database): Promise<Library[]> {
	return (await listLibraries(db)).filter((library) => library.enabled);
}

export async function getLibrary(db: D1Database, id: string): Promise<Library | null> {
	return (await listLibraries(db)).find((library) => library.id === id) ?? null;
}

/** Adds libraries for catalogs that do not have one yet; existing libraries keep their name and state. */
export async function ensureCatalogLibraries(
	db: D1Database,
	addonId: string,
	catalogs: { type: 'movie' | 'series'; id: string; name: string }[],
	enabled: boolean
): Promise<void> {
	if (catalogs.length === 0) return;
	await db.batch(
		catalogs.map((catalog) =>
			db
				.prepare(
					`INSERT OR IGNORE INTO libraries (id, kind, addon_id, catalog_type, catalog_id, name, enabled, position)
					VALUES (?, 'catalog', ?, ?, ?, ?, ?, (SELECT coalesce(max(position), -1) + 1 FROM libraries))`
				)
				.bind(randomHex(16), addonId, catalog.type, catalog.id, catalog.name, enabled ? 1 : 0)
		)
	);
	invalidateConfig();
}

export interface NewCollection {
	name: string;
	type: LibraryType;
	sources?: CollectionSource[];
	image?: string | null;
	imageAspect?: number | null;
}

function insertCollection(db: D1Database, id: string, collection: NewCollection) {
	const sources = collection.sources ?? [];
	// Catalog-backed collections reference their addon so removing the addon removes them too.
	const catalog = sources.find((source) => source.kind === 'catalog');
	return db
		.prepare(
			`INSERT INTO libraries (id, kind, addon_id, catalog_type, name, enabled, position, sources, image, image_aspect)
			VALUES (?, 'collection', ?, ?, ?, 1, (SELECT coalesce(max(position), -1) + 1 FROM libraries), ?, ?, ?)`
		)
		.bind(
			id,
			catalog?.addonId ?? null,
			collection.type,
			collection.name,
			sources.length ? JSON.stringify(sources) : null,
			collection.image ?? null,
			collection.imageAspect ?? null
		);
}

export async function createCollection(
	db: D1Database,
	name: string,
	type: LibraryType,
	sources: CollectionSource[] = []
): Promise<string> {
	const [id] = await createCollections(db, [{ name, type, sources }]);
	return id;
}

/** Creates several collections in one batch, appended in the given order. */
export async function createCollections(
	db: D1Database,
	collections: NewCollection[]
): Promise<string[]> {
	if (collections.length === 0) return [];
	const ids = collections.map(() => randomHex(16));
	await db.batch(
		collections.map((collection, index) => insertCollection(db, ids[index], collection))
	);
	invalidateConfig();
	return ids;
}

export interface LibraryChanges {
	name?: string;
	enabled?: boolean;
	image?: { url: string | null; aspect: number | null };
}

export async function updateLibrary(
	db: D1Database,
	id: string,
	changes: LibraryChanges
): Promise<void> {
	const statements: D1PreparedStatement[] = [];
	if (changes.name !== undefined) {
		statements.push(
			db.prepare('UPDATE libraries SET name = ? WHERE id = ?').bind(changes.name, id)
		);
	}
	if (changes.enabled !== undefined) {
		statements.push(
			db.prepare('UPDATE libraries SET enabled = ? WHERE id = ?').bind(changes.enabled ? 1 : 0, id)
		);
	}
	if (changes.image !== undefined) {
		statements.push(
			db
				.prepare('UPDATE libraries SET image = ?, image_aspect = ? WHERE id = ?')
				.bind(changes.image.url, changes.image.aspect, id)
		);
	}
	if (statements.length > 0) await db.batch(statements);
	if (changes.image !== undefined) await deleteOrphanImages(db);
	invalidateConfig();
}

/** Sets the artwork of several libraries at once (a pack applied to existing libraries). */
export async function setLibraryImages(
	db: D1Database,
	images: { id: string; image: string; imageAspect: number }[]
): Promise<void> {
	if (images.length === 0) return;
	await db.batch(
		images.map((item) =>
			db
				.prepare('UPDATE libraries SET image = ?, image_aspect = ? WHERE id = ?')
				.bind(item.image, item.imageAspect, item.id)
		)
	);
	await deleteOrphanImages(db);
	invalidateConfig();
}

export async function deleteLibrary(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM libraries WHERE id = ?').bind(id).run();
	await deleteOrphanImages(db);
	invalidateConfig();
}

export const UPLOAD_PREFIX = 'upload:';
/** D1 rows are limited to 2 MB; the dashboard resizes artwork well below this. */
export const MAX_IMAGE_BYTES = 1024 * 1024;

export async function saveImage(
	db: D1Database,
	contentType: string,
	data: ArrayBuffer
): Promise<string> {
	const id = randomHex(16);
	await db
		.prepare('INSERT INTO images (id, content_type, data, created_at) VALUES (?, ?, ?, ?)')
		.bind(id, contentType, data, Date.now())
		.run();
	return `${UPLOAD_PREFIX}${id}`;
}

export async function loadImage(
	db: D1Database,
	ref: string
): Promise<{ contentType: string; data: ArrayBuffer } | null> {
	if (!ref.startsWith(UPLOAD_PREFIX)) return null;
	const row = await db
		.prepare('SELECT content_type, data FROM images WHERE id = ?')
		.bind(ref.slice(UPLOAD_PREFIX.length))
		.first<{ content_type: string; data: ArrayBuffer | number[] }>();
	if (!row) return null;
	const data = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
	return { contentType: row.content_type, data };
}

/** Uploads are only reachable through a library, so replaced or deleted artwork is dropped. */
async function deleteOrphanImages(db: D1Database): Promise<void> {
	await db
		.prepare(
			`DELETE FROM images WHERE ('${UPLOAD_PREFIX}' || id) NOT IN
			(SELECT image FROM libraries WHERE image IS NOT NULL)`
		)
		.run();
}

export async function listCollectionItems(
	db: D1Database,
	libraryId: string
): Promise<CollectionItem[]> {
	const { results } = await db
		.prepare('SELECT * FROM collection_items WHERE library_id = ? ORDER BY position')
		.bind(libraryId)
		.all<CollectionItemRow>();
	return results.map((row) => ({
		libraryId: row.library_id,
		stremioType: row.stremio_type,
		stremioId: row.stremio_id,
		name: row.name,
		poster: row.poster,
		position: row.position
	}));
}

export async function addCollectionItem(
	db: D1Database,
	item: Omit<CollectionItem, 'position'>
): Promise<void> {
	await db
		.prepare(
			`INSERT OR IGNORE INTO collection_items (library_id, stremio_type, stremio_id, name, poster, position)
			VALUES (?, ?, ?, ?, ?, (SELECT coalesce(max(position), -1) + 1 FROM collection_items WHERE library_id = ?))`
		)
		.bind(item.libraryId, item.stremioType, item.stremioId, item.name, item.poster, item.libraryId)
		.run();
}

export async function removeCollectionItem(
	db: D1Database,
	libraryId: string,
	stremioId: string
): Promise<void> {
	await db
		.prepare('DELETE FROM collection_items WHERE library_id = ? AND stremio_id = ?')
		.bind(libraryId, stremioId)
		.run();
}

export async function reorderCollection(
	db: D1Database,
	libraryId: string,
	stremioIds: string[]
): Promise<void> {
	if (stremioIds.length === 0) return;
	await db.batch(
		stremioIds.map((stremioId, position) =>
			db
				.prepare('UPDATE collection_items SET position = ? WHERE library_id = ? AND stremio_id = ?')
				.bind(position, libraryId, stremioId)
		)
	);
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
	const row = await db
		.prepare('SELECT value FROM settings WHERE key = ?')
		.bind(key)
		.first<{ value: string }>();
	return row?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string | null): Promise<void> {
	if (value === null) {
		await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
	} else {
		await db
			.prepare(
				'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
			)
			.bind(key, value)
			.run();
	}
}

export async function getDisplayPrefs(
	db: D1Database,
	id: string,
	client: string
): Promise<unknown | null> {
	const row = await db
		.prepare('SELECT data FROM display_prefs WHERE id = ? AND client = ?')
		.bind(id, client)
		.first<{ data: string }>();
	return row ? JSON.parse(row.data) : null;
}

export async function setDisplayPrefs(
	db: D1Database,
	id: string,
	client: string,
	data: unknown
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO display_prefs (id, client, data) VALUES (?, ?, ?) ON CONFLICT (id, client) DO UPDATE SET data = excluded.data'
		)
		.bind(id, client, JSON.stringify(data))
		.run();
}
