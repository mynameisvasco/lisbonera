import { metahubPoster } from './mdblist';
import { fetchJson, type Scope } from './scope';
import { loadCredentials } from './scrobble/service';
import type { MetaPreview } from './stremio/types';

const API = 'https://api.trakt.tv';
const LIST_TTL = 30 * 60;
const TIMEOUT = 8000;
export const TRAKT_PAGE = 100;

interface TraktListEntry {
	type?: string;
	movie?: TraktTitle;
	show?: TraktTitle;
}

interface TraktTitle {
	title?: string;
	year?: number | null;
	ids?: { imdb?: string | null; tmdb?: number | null };
}

/**
 * Public Trakt lists only need the API app's client ID, the same one used for scrobbling.
 * Lists are read without signing in, so any user's public list works.
 */
export async function traktClientId(env: Env): Promise<string | null> {
	return (await loadCredentials(env, 'trakt'))?.clientId ?? null;
}

/** Accepts `https://trakt.tv/users/{user}/lists/{slug}` (also `app.trakt.tv`) or `{user}/{slug}`. */
export function parseTraktList(input: string): { user: string; slug: string } | null {
	const value = input.trim();
	let path = value;
	if (/^https?:\/\//i.test(value)) {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			return null;
		}
		if (!/(^|\.)trakt\.tv$/i.test(url.hostname)) return null;
		path = url.pathname;
	}
	const match = /^\/?(?:users\/)?([\w.-]+)\/(?:lists\/)?([\w.-]+)\/?$/.exec(path);
	return match ? { user: match[1], slug: match[2] } : null;
}

function toMeta(entry: TraktListEntry): MetaPreview | null {
	const title = entry.type === 'movie' ? entry.movie : entry.type === 'show' ? entry.show : null;
	if (!title?.title) return null;
	const imdb = title.ids?.imdb && /^tt\d+$/.test(title.ids.imdb) ? title.ids.imdb : null;
	const id = imdb ?? (title.ids?.tmdb ? `tmdb:${title.ids.tmdb}` : null);
	if (!id) return null;
	return {
		id,
		type: entry.type === 'movie' ? 'movie' : 'series',
		name: title.title,
		poster: imdb ? metahubPoster(imdb) : undefined,
		releaseInfo: title.year ?? undefined
	};
}

/** One page (1-based) of a list's movies and shows in the list's own order. */
export async function fetchTraktListPage(
	scope: Scope,
	clientId: string,
	list: { user: string; slug: string },
	page: number
): Promise<{ metas: MetaPreview[]; count: number }> {
	const url = `${API}/users/${encodeURIComponent(list.user)}/lists/${encodeURIComponent(list.slug)}/items/movie,show?page=${page}&limit=${TRAKT_PAGE}`;
	const entries = await fetchJson<TraktListEntry[]>(scope, url, {
		ttl: LIST_TTL,
		timeoutMs: TIMEOUT,
		init: { headers: { 'trakt-api-version': '2', 'trakt-api-key': clientId } }
	});
	const items = Array.isArray(entries) ? entries : [];
	return {
		metas: items.map(toMeta).filter((meta): meta is MetaPreview => meta !== null),
		count: items.length
	};
}

export class TraktListError extends Error {}

/** Name and size of a public list, used to prefill a new collection. */
export async function fetchTraktListInfo(
	scope: Scope,
	clientId: string,
	list: { user: string; slug: string }
): Promise<{ name: string; items: number | null }> {
	try {
		const body = await fetchJson<{ name?: string; item_count?: number }>(
			scope,
			`${API}/users/${encodeURIComponent(list.user)}/lists/${encodeURIComponent(list.slug)}`,
			{
				ttl: 0,
				timeoutMs: TIMEOUT,
				init: { headers: { 'trakt-api-version': '2', 'trakt-api-key': clientId } }
			}
		);
		if (!body?.name) throw new TraktListError('List not found on Trakt');
		return { name: body.name, items: body.item_count ?? null };
	} catch (error) {
		if (error instanceof TraktListError) throw error;
		const status = error instanceof Error ? error.message : '';
		if (/HTTP 404/.test(status))
			throw new TraktListError('List not found on Trakt, or it is private');
		if (/HTTP 40[13]/.test(status))
			throw new TraktListError('Trakt rejected the API app’s client ID');
		throw new TraktListError(`Could not reach Trakt${status ? ` (${status})` : ''}`);
	}
}
