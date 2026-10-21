import { handleJellyfin, isJellyfinPath } from '../src/lib/server/jellyfin/api';

/** Mirrors src/hooks.server.ts: Jellyfin paths go to the API, everything else to SvelteKit. */
export default {
	fetch(request, env, ctx) {
		if (isJellyfinPath(new URL(request.url).pathname)) return handleJellyfin(request, env, ctx);
		return new Response('sveltekit');
	}
} satisfies ExportedHandler<Env>;
