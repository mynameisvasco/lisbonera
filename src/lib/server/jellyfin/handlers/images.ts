import { notFound } from '../../http';
import { itemGuid, type IdEntry } from '../../ids';
import { USER_AGENT } from '../../scope';
import { getLibrary, loadImage, UPLOAD_PREFIX } from '../../store';
import type { JfContext } from '../context';
import type { Router } from '../router';

const IMAGE_TTL = 7 * 24 * 3600;

async function imageUrl(c: JfContext, entry: IdEntry, type: string): Promise<string | null> {
	const pick = (source: Pick<IdEntry, 'poster' | 'background' | 'logo'>): string | null => {
		switch (type) {
			case 'primary':
				return source.poster;
			case 'backdrop':
			case 'art':
				return source.background;
			case 'thumb':
				return source.background ?? source.poster;
			case 'logo':
				return source.logo;
			default:
				return null;
		}
	};
	const own = pick(entry);
	if (own || entry.kind === 'movie' || entry.kind === 'series') return own;
	// Seasons have no art of their own, and episodes only a thumbnail.
	const series = await c.ids.resolve(await itemGuid('series', entry.stremioId));
	return series ? pick(series) : null;
}

/**
 * Images are proxied and cached at the edge so clients load them from a nearby Cloudflare location.
 * Jellyfin serves images without authentication, and clients rely on that.
 */
async function image(c: JfContext): Promise<Response> {
	const cache = await caches.open('lisbonera-images');
	// The tag changes with the source URL, so a new poster gets a new cache entry.
	const tag = c.query.get('tag') ?? '';
	const key = new Request(
		`${c.origin}/items/${c.params.itemId}/images/${c.params.type}?tag=${tag}`
	);
	if (c.budget.take()) {
		const hit = await cache.match(key);
		if (hit) return hit;
	}

	const id = c.params.itemId.toLowerCase().replace(/-/g, '');
	const library = await getLibrary(c.env.DB, id);
	let url: string | null;
	if (library) {
		url = c.params.type === 'primary' || c.params.type === 'thumb' ? library.image : null;
		if (url?.startsWith(UPLOAD_PREFIX)) {
			const stored = await loadImage(c.env.DB, url);
			if (!stored) return notFound();
			return cached(
				c,
				cache,
				key,
				new Response(stored.data, { headers: headers(stored.contentType) })
			);
		}
	} else {
		const entry = await c.ids.resolve(id);
		url = entry ? await imageUrl(c, entry, c.params.type) : null;
	}
	if (!url || !c.budget.take()) return notFound();

	const upstream = await fetch(url, {
		headers: { 'user-agent': USER_AGENT },
		cf: { cacheTtl: IMAGE_TTL, cacheEverything: true }
	}).catch(() => null);
	if (!upstream?.ok || !upstream.body) return notFound();

	return cached(
		c,
		cache,
		key,
		new Response(upstream.body, {
			headers: headers(upstream.headers.get('content-type') ?? 'image/jpeg')
		})
	);
}

function headers(contentType: string): HeadersInit {
	return {
		'content-type': contentType,
		'cache-control': `public, max-age=${IMAGE_TTL}, immutable`
	};
}

function cached(c: JfContext, cache: Cache, key: Request, response: Response): Response {
	if (c.budget.take()) c.exec.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
	return response;
}

export function imageRoutes(router: Router): void {
	router.on('GET', ['/items/:itemId/images/:type', '/items/:itemId/images/:type/:index'], image, {
		public: true
	});
}
