import { guid } from '../crypto';
import type { IdEntry } from '../ids';
import { memo, type Scope } from '../scope';
import { listAddons } from '../store';
import { fetchStreams } from '../stremio/client';
import type { Stream } from '../stremio/types';

const SOURCES_TTL = 2 * 3600;

export interface ResolvedSource {
	id: string;
	name: string;
	url: string;
	filename?: string;
	size?: number;
}

/** Streams a Jellyfin client can play from a redirect: plain http(s) without required proxy headers. */
export function isPlayable(stream: Stream): stream is Stream & { url: string } {
	return (
		typeof stream.url === 'string' &&
		/^https?:\/\//i.test(stream.url) &&
		!stream.behaviorHints?.proxyHeaders
	);
}

export function sourceName(addonName: string, stream: Stream): string {
	const label = (stream.name ?? addonName).replace(/\s+/g, ' ').trim();
	const detail = (stream.title ?? stream.description ?? '').split('\n')[0]?.trim();
	return detail ? `${label} · ${detail}` : label;
}

function cacheKey(scope: Scope, itemGuid: string): Request {
	return new Request(`${scope.origin}/__lisbonera/sources/${itemGuid}`);
}

/**
 * Resolves the playable sources of a movie or episode. The list is cached for two hours (isolate + edge cache) so the
 * ids shown by `PlaybackInfo` still resolve when the client asks for the stream. Source ids depend on the addon and
 * the stream identity, not on the URL, because debrid URLs expire.
 */
export async function resolveSources(scope: Scope, entry: IdEntry): Promise<ResolvedSource[]> {
	const memoKey = `sources:${entry.guid}`;
	const cached = memo.get<ResolvedSource[]>(memoKey, SOURCES_TTL * 1000);
	if (cached?.fresh) return cached.value;

	const cache = await caches.open('lisbonera');
	if (scope.budget.take()) {
		const hit = await cache.match(cacheKey(scope, entry.guid));
		if (hit) {
			const sources = (await hit.json()) as ResolvedSource[];
			memo.set(memoKey, sources);
			return sources;
		}
	}

	const type = entry.kind === 'movie' ? 'movie' : 'series';
	const videoId = entry.kind === 'movie' ? entry.stremioId : entry.videoId;
	if (!videoId) return [];

	const results = await fetchStreams(scope, await listAddons(scope.env.DB), type, videoId);
	const sources: ResolvedSource[] = [];
	const seenUrls = new Set<string>();
	const seenIds = new Set<string>();
	for (const { addon, streams } of results) {
		const addonName = addon.manifest?.name ?? addon.url;
		for (const stream of streams) {
			if (!isPlayable(stream) || seenUrls.has(stream.url)) continue;
			seenUrls.add(stream.url);
			const identity = [
				addon.id,
				stream.behaviorHints?.filename ?? '',
				stream.behaviorHints?.videoSize ?? '',
				stream.name ?? '',
				stream.title ?? stream.description ?? ''
			].join('|');
			let id = await guid(identity);
			for (let n = 2; seenIds.has(id); n++) id = await guid(`${identity}|${n}`);
			seenIds.add(id);
			sources.push({
				id,
				name: sourceName(addonName, stream),
				url: stream.url,
				filename: stream.behaviorHints?.filename,
				size: stream.behaviorHints?.videoSize
			});
		}
	}

	// An empty list usually means addons timed out; it is retried on the next request instead of being cached.
	if (sources.length === 0) return sources;
	memo.set(memoKey, sources);
	if (scope.budget.take()) {
		scope.exec.waitUntil(
			cache
				.put(
					cacheKey(scope, entry.guid),
					Response.json(sources, { headers: { 'cache-control': `max-age=${SOURCES_TTL}` } })
				)
				.catch(() => undefined)
		);
	}
	return sources;
}

/** URL for a source id; unknown ids (including clients that send the item id) fall back to the first source. */
export async function sourceUrl(
	scope: Scope,
	entry: IdEntry,
	mediaSourceId: string | undefined
): Promise<string | null> {
	const sources = await resolveSources(scope, entry);
	const wanted = mediaSourceId?.toLowerCase().replace(/-/g, '');
	return (sources.find((source) => source.id === wanted) ?? sources[0])?.url ?? null;
}
