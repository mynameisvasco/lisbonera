import type { JfContext } from './context';

export type Handler = (c: JfContext) => Promise<Response> | Response;

export interface RouteOptions {
	/** Reachable without a session token. */
	public?: boolean;
}

interface Route {
	methods: Set<string>;
	pattern: RegExp;
	keys: string[];
	handler: Handler;
	public: boolean;
}

export interface Match {
	handler: Handler;
	params: Record<string, string>;
	public: boolean;
}

const NON_API_PREFIXES = ['/admin', '/_app', '/favicon', '/robots.txt'];

/** Everything except the dashboard, SvelteKit's assets and the landing page belongs to the Jellyfin API. */
export function isJellyfinPath(pathname: string): boolean {
	if (pathname === '/') return false;
	const lower = pathname.toLowerCase();
	return !NON_API_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(prefix + '.'));
}

/** Jellyfin routes are case-insensitive and some clients still use the legacy `/emby` prefix. */
export function normalizePath(pathname: string): string {
	let path = pathname.toLowerCase().replace(/\/{2,}/g, '/');
	path = path.replace(/^\/(emby|jellyfin)(?=\/|$)/, '');
	if (path.length > 1) path = path.replace(/\/+$/, '');
	return path || '/';
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
	const keys: string[] = [];
	const source = path
		.toLowerCase()
		.split(/(:[a-zA-Z]+)/)
		.map((part) => {
			if (part.startsWith(':')) {
				keys.push(part.slice(1));
				return '([^/]+?)';
			}
			return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		})
		.join('');
	return { pattern: new RegExp(`^${source}$`), keys };
}

export class Router {
	readonly #routes: Route[] = [];

	on(methods: string | string[], paths: string | string[], handler: Handler, options: RouteOptions = {}): this {
		const methodSet = new Set((Array.isArray(methods) ? methods : [methods]).map((method) => method.toUpperCase()));
		if (methodSet.has('GET')) methodSet.add('HEAD');
		for (const path of Array.isArray(paths) ? paths : [paths]) {
			const { pattern, keys } = compile(path);
			this.#routes.push({ methods: methodSet, pattern, keys, handler, public: options.public ?? false });
		}
		return this;
	}

	match(method: string, path: string): Match | null {
		for (const route of this.#routes) {
			if (!route.methods.has(method)) continue;
			const found = route.pattern.exec(path);
			if (!found) continue;
			const params: Record<string, string> = {};
			route.keys.forEach((key, index) => {
				params[key] = decodeURIComponent(found[index + 1]);
			});
			return { handler: route.handler, params, public: route.public };
		}
		return null;
	}
}
