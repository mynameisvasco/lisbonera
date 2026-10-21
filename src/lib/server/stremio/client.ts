import { fetchJson, memo, type Scope, UpstreamError } from '../scope';
import type { Addon, Manifest, ManifestCatalog, Meta, MetaPreview, Stream } from './types';

const CATALOG_TTL = 30 * 60;
const META_TTL = 6 * 3600;
const CATALOG_TIMEOUT = 5000;
const STREAM_TIMEOUT = 8000;
const ERROR_RECORD_INTERVAL = 10 * 60 * 1000;

/** Accepts `https://…/manifest.json`, `stremio://…` and bare base URLs; returns the base URL without a trailing slash. */
export function normalizeAddonUrl(input: string): string {
	let url = input.trim();
	if (url.startsWith('stremio://')) url = `https://${url.slice('stremio://'.length)}`;
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error('Addon URL must use http or https');
	}
	return parsed.href.replace(/\/manifest\.json$/, '').replace(/\/+$/, '');
}

export async function fetchManifest(scope: Scope, url: string): Promise<Manifest> {
	const manifest = await fetchJson<Manifest>(scope, `${url}/manifest.json`, {
		ttl: 0,
		timeoutMs: CATALOG_TIMEOUT
	});
	if (!manifest?.id || !Array.isArray(manifest.resources)) {
		throw new UpstreamError(url, 'Invalid manifest');
	}
	manifest.catalogs ??= [];
	manifest.types ??= [];
	return manifest;
}

export function supports(manifest: Manifest, resource: string, type: string, id?: string): boolean {
	for (const entry of manifest.resources) {
		const name = typeof entry === 'string' ? entry : entry.name;
		if (name !== resource) continue;
		const types = (typeof entry === 'string' ? undefined : entry.types) ?? manifest.types;
		if (!types.includes(type)) continue;
		const prefixes = (typeof entry === 'string' ? undefined : entry.idPrefixes) ?? manifest.idPrefixes;
		if (id && prefixes?.length && !prefixes.some((prefix) => id.startsWith(prefix))) continue;
		return true;
	}
	return false;
}

export function catalogExtras(catalog: ManifestCatalog): { supported: Set<string>; required: Set<string> } {
	const supported = new Set(catalog.extraSupported ?? []);
	const required = new Set(catalog.extraRequired ?? []);
	for (const extra of catalog.extra ?? []) {
		supported.add(extra.name);
		if (extra.isRequired) required.add(extra.name);
	}
	return { supported, required };
}

/** A catalog can back a library when it needs no input other than paging. */
export function isBrowsable(catalog: ManifestCatalog): boolean {
	const { required } = catalogExtras(catalog);
	return [...required].every((name) => name === 'skip');
}

export function isSearchable(catalog: ManifestCatalog): boolean {
	return catalogExtras(catalog).supported.has('search');
}

export function catalogUrl(
	addon: Pick<Addon, 'url'>,
	type: string,
	catalogId: string,
	extra: Record<string, string | number> = {}
): string {
	const parts = Object.entries(extra)
		.filter(([, value]) => value !== '' && value !== 0)
		.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
	const suffix = parts.length ? `/${parts.join('&')}` : '';
	return `${addon.url}/catalog/${type}/${encodeURIComponent(catalogId)}${suffix}.json`;
}

function recordError(scope: Scope, addon: Addon, error: unknown): void {
	const key = `addon-error:${addon.id}`;
	if (memo.get(key, ERROR_RECORD_INTERVAL)?.fresh) return;
	memo.set(key, true);
	const message = error instanceof Error ? error.message : String(error);
	scope.exec.waitUntil(
		scope.env.DB.prepare('UPDATE addons SET last_error = ?, checked_at = ? WHERE id = ?')
			.bind(message.slice(0, 500), Date.now(), addon.id)
			.run()
			.catch(() => undefined)
	);
}

export async function fetchCatalog(
	scope: Scope,
	addon: Addon,
	type: string,
	catalogId: string,
	extra: Record<string, string | number> = {}
): Promise<MetaPreview[]> {
	try {
		const body = await fetchJson<{ metas?: MetaPreview[] }>(scope, catalogUrl(addon, type, catalogId, extra), {
			ttl: CATALOG_TTL,
			timeoutMs: CATALOG_TIMEOUT
		});
		return (body.metas ?? []).filter((meta) => meta?.id && meta.name);
	} catch (error) {
		recordError(scope, addon, error);
		throw error;
	}
}

/** Asks each enabled addon that declares `meta` support for this id, in priority order. */
export async function fetchMeta(scope: Scope, addons: Addon[], type: string, id: string): Promise<Meta | null> {
	for (const addon of addons) {
		if (!addon.enabled || !addon.manifest || !supports(addon.manifest, 'meta', type, id)) continue;
		try {
			const body = await fetchJson<{ meta?: Meta }>(
				scope,
				`${addon.url}/meta/${type}/${encodeURIComponent(id)}.json`,
				{ ttl: META_TTL, timeoutMs: CATALOG_TIMEOUT }
			);
			if (body.meta?.id) return body.meta;
		} catch (error) {
			if (!(error instanceof UpstreamError) || error.name === 'BudgetExhausted') throw error;
			recordError(scope, addon, error);
		}
	}
	return null;
}

export interface AddonStreams {
	addon: Addon;
	streams: Stream[];
}

/** Queries every stream addon in parallel; failing addons are recorded and skipped. */
export async function fetchStreams(
	scope: Scope,
	addons: Addon[],
	type: string,
	videoId: string
): Promise<AddonStreams[]> {
	const sources = addons.filter(
		(addon) => addon.enabled && addon.manifest && supports(addon.manifest, 'stream', type, videoId)
	);
	const results = await Promise.allSettled(
		sources.map(async (addon) => {
			const body = await fetchJson<{ streams?: Stream[] }>(
				scope,
				`${addon.url}/stream/${type}/${encodeURIComponent(videoId)}.json`,
				{ ttl: 0, timeoutMs: STREAM_TIMEOUT }
			);
			return { addon, streams: body.streams ?? [] };
		})
	);
	return results.flatMap((result, index) => {
		if (result.status === 'fulfilled') return [result.value];
		recordError(scope, sources[index], result.reason);
		return [];
	});
}
