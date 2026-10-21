import { randomHex } from './crypto';
import { memo } from './scope';
import type { Addon, Manifest } from './stremio/types';

const CONFIG_TTL = 30 * 1000;

export type LibraryType = 'movie' | 'series' | 'mixed';

export interface Library {
	id: string;
	kind: 'catalog' | 'collection';
	addonId: string | null;
	catalogType: LibraryType;
	catalogId: string | null;
	name: string;
	enabled: boolean;
	position: number;
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

function toLibrary(row: LibraryRow): Library {
	return {
		id: row.id,
		kind: row.kind,
		addonId: row.addon_id,
		catalogType: row.catalog_type,
		catalogId: row.catalog_id,
		name: row.name,
		enabled: row.enabled === 1,
		position: row.position
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

export async function createCollection(
	db: D1Database,
	name: string,
	type: LibraryType
): Promise<string> {
	const id = randomHex(16);
	await db
		.prepare(
			`INSERT INTO libraries (id, kind, catalog_type, name, enabled, position)
			VALUES (?, 'collection', ?, ?, 1, (SELECT coalesce(max(position), -1) + 1 FROM libraries))`
		)
		.bind(id, type, name)
		.run();
	invalidateConfig();
	return id;
}

export async function updateLibrary(
	db: D1Database,
	id: string,
	changes: { name?: string; enabled?: boolean }
): Promise<void> {
	if (changes.name !== undefined) {
		await db.prepare('UPDATE libraries SET name = ? WHERE id = ?').bind(changes.name, id).run();
	}
	if (changes.enabled !== undefined) {
		await db
			.prepare('UPDATE libraries SET enabled = ? WHERE id = ?')
			.bind(changes.enabled ? 1 : 0, id)
			.run();
	}
	invalidateConfig();
}

export async function deleteLibrary(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM libraries WHERE id = ?').bind(id).run();
	invalidateConfig();
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
