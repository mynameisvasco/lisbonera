import { handleJellyfin } from './jellyfin/api';
import { isJellyfinPath } from './jellyfin/router';

/**
 * Wraps the SvelteKit worker. The Jellyfin API is handled here, before SvelteKit, because SvelteKit's CSRF check
 * rejects the bodiless POSTs native clients send without an `Origin` header (and cannot be disabled since 3.0).
 */
export function createWorker(kit: ExportedHandler<Env>): ExportedHandler<Env> {
	return {
		async fetch(request, env, ctx) {
			const { pathname } = new URL(request.url);
			if (isJellyfinPath(pathname)) return handleJellyfin(request, env, ctx);
			return kit.fetch!(request, env, ctx);
		}
	};
}
