import { authenticate, extractToken, touchSession } from '../auth/client';
import { json, Query, unauthorized } from '../http';
import { IdMap } from '../ids';
import { createScope } from '../scope';
import { dtoContext, type JfContext } from './context';
import { imageRoutes } from './handlers/images';
import { itemRoutes } from './handlers/items';
import { playbackRoutes } from './handlers/playback';
import { sessionRoutes } from './handlers/sessions';
import { systemRoutes } from './handlers/system';
import { userRoutes } from './handlers/users';
import { normalizePath, Router } from './router';

export { isJellyfinPath } from './router';

const router = new Router();
systemRoutes(router);
userRoutes(router);
itemRoutes(router);
playbackRoutes(router);
sessionRoutes(router);
imageRoutes(router);

const CORS_HEADERS: Record<string, string> = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
	'access-control-allow-headers':
		'Accept, Authorization, Content-Type, Origin, Range, X-Emby-Authorization, X-Emby-Token, X-MediaBrowser-Token',
	'access-control-max-age': '86400'
};

function withCors(response: Response): Response {
	const result = new Response(response.body, response);
	for (const [name, value] of Object.entries(CORS_HEADERS)) result.headers.set(name, value);
	return result;
}

export async function handleJellyfin(
	request: Request,
	env: Env,
	exec: Pick<ExecutionContext, 'waitUntil'>
): Promise<Response> {
	if (request.method === 'OPTIONS')
		return new Response(null, { status: 204, headers: CORS_HEADERS });

	const url = new URL(request.url);
	const match = router.match(request.method, normalizePath(url.pathname));
	if (!match) {
		console.warn(`jellyfin: unhandled ${request.method} ${url.pathname}`);
		return withCors(json({ message: 'Not found' }, 404));
	}

	const query = new Query(url.searchParams);
	const session = await authenticate(env.DB, extractToken(request, query));
	if (!match.public && !session) return withCors(unauthorized());

	const username = env.JELLYFIN_USERNAME || 'admin';
	const c: JfContext = {
		...createScope(env, exec, url),
		request,
		url,
		query,
		params: match.params,
		session,
		ids: new IdMap(env.DB),
		dto: await dtoContext(url.origin, username),
		username
	};

	try {
		const response = await match.handler(c);
		await c.ids.flush();
		if (session) exec.waitUntil(touchSession(env.DB, session).catch(() => undefined));
		return withCors(response);
	} catch (error) {
		console.error(`jellyfin: ${request.method} ${url.pathname} failed`, error);
		return withCors(json({ message: 'Internal server error' }, 500));
	}
}
