import { decrypt, encrypt } from './crypto';
import { fetchJson, type Scope } from './scope';
import { getSetting, setSetting, type LibraryType } from './store';
import type { MetaPreview } from './stremio/types';

/** MDBList API: https://mdblist.docs.apiary.io. Keys are free at https://mdblist.com/preferences. */
export const MDBLIST_API = 'https://api.mdblist.com';
const KEY_SETTING = 'mdblist:key';
const LIST_TTL = 30 * 60;
const TIMEOUT = 8000;
export const MDBLIST_PAGE = 100;

export class MdblistError extends Error {}

/**
 * Accepts `https://mdblist.com/lists/{user}/{slug}`, `{user}/{slug}` or a numeric list id and returns the path
 * segment the API expects (`{user}/{slug}` or `{id}`).
 */
export function parseListRef(input: string): string | null {
	const value = input.trim();
	if (/^\d+$/.test(value)) return value;
	let path = value;
	if (/^https?:\/\//i.test(value)) {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			return null;
		}
		if (!/(^|\.)mdblist\.com$/i.test(url.hostname)) return null;
		path = url.pathname;
	}
	const segments = path
		.replace(/^\/?(lists\/)?/, '')
		.split('/')
		.filter(Boolean);
	if (segments.length === 1 && /^\d+$/.test(segments[0])) return segments[0];
	if (segments.length < 2) return null;
	const [user, slug] = segments;
	const valid = /^[\w.-]+$/;
	return valid.test(user) && valid.test(slug) ? `${user}/${slug}` : null;
}

export async function loadMdblistKey(env: Env): Promise<string | null> {
	const stored = await getSetting(env.DB, KEY_SETTING);
	if (!stored) return null;
	try {
		return await decrypt(env.ENCRYPTION_KEY, stored);
	} catch {
		return null;
	}
}

export async function saveMdblistKey(env: Env, key: string | null): Promise<void> {
	await setSetting(env.DB, KEY_SETTING, key ? await encrypt(env.ENCRYPTION_KEY, key) : null);
}

interface ListInfo {
	name?: string;
	mediatype?: string | null;
	items?: number;
}

interface ListItem {
	imdb_id?: string | null;
	tmdb_id?: number | null;
	title?: string;
	mediatype?: string;
	release_year?: number | null;
}

function listUrl(key: string, ref: string, suffix = '', params: Record<string, string> = {}) {
	const query = new URLSearchParams({ apikey: key, ...params });
	return `${MDBLIST_API}/lists/${ref}${suffix}?${query}`;
}

/** Name and content type of a list, used to prefill a new collection. */
export async function fetchListInfo(
	scope: Scope,
	key: string,
	ref: string
): Promise<{ name: string; type: LibraryType; items: number | null }> {
	let body: ListInfo | ListInfo[];
	try {
		body = await fetchJson<ListInfo | ListInfo[]>(scope, listUrl(key, ref), {
			ttl: 0,
			timeoutMs: TIMEOUT
		});
	} catch (error) {
		const status = error instanceof Error ? error.message : '';
		if (/HTTP 40[13]/.test(status)) throw new MdblistError('MDBList rejected the API key');
		if (/HTTP 404/.test(status)) throw new MdblistError('List not found on MDBList');
		throw new MdblistError(`Could not reach MDBList${status ? ` (${status})` : ''}`);
	}
	const info = Array.isArray(body) ? body[0] : body;
	if (!info?.name) throw new MdblistError('List not found on MDBList');
	const type: LibraryType =
		info.mediatype === 'movie' ? 'movie' : info.mediatype === 'show' ? 'series' : 'mixed';
	return { name: info.name, type, items: typeof info.items === 'number' ? info.items : null };
}

/** Stremio's own image service, keyed by IMDb id; the same art Cinemeta serves. */
export function metahubPoster(imdbId: string): string {
	return `https://images.metahub.space/poster/medium/${imdbId}/img`;
}

function toMeta(item: ListItem): MetaPreview | null {
	const type = item.mediatype === 'show' ? 'series' : item.mediatype === 'movie' ? 'movie' : null;
	if (!type || !item.title) return null;
	const imdb = item.imdb_id && /^tt\d+$/.test(item.imdb_id) ? item.imdb_id : null;
	const id = imdb ?? (item.tmdb_id ? `tmdb:${item.tmdb_id}` : null);
	if (!id) return null;
	return {
		id,
		type,
		name: item.title,
		poster: imdb ? metahubPoster(imdb) : undefined,
		releaseInfo: item.release_year ?? undefined
	};
}

/**
 * One page of a list in MDBList's own order, plus how many raw entries it covered (entries without a usable id
 * are dropped). Accepts both the unified and the grouped response shape.
 */
export async function fetchListPage(
	scope: Scope,
	key: string,
	ref: string,
	offset: number
): Promise<{ metas: MetaPreview[]; count: number }> {
	const body = await fetchJson<ListItem[] | { movies?: ListItem[]; shows?: ListItem[] }>(
		scope,
		listUrl(key, ref, '/items', {
			limit: String(MDBLIST_PAGE),
			offset: String(offset),
			unified: 'true'
		}),
		{ ttl: LIST_TTL, timeoutMs: TIMEOUT }
	);
	const items = Array.isArray(body) ? body : [...(body.movies ?? []), ...(body.shows ?? [])];
	return {
		metas: items.map(toMeta).filter((meta): meta is MetaPreview => meta !== null),
		count: items.length
	};
}
