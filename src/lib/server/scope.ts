export const USER_AGENT =
	'Mozilla/5.0 (compatible; Lisbonera/0.1; +https://github.com/lisbonera/lisbonera)';

/**
 * Free-plan Workers allow 50 external subrequests per invocation and Cache API calls count towards it.
 * Five are left in reserve for D1-independent work such as the final image or scrobble call.
 */
export const SUBREQUEST_BUDGET = 45;

export class Budget {
	#left: number;

	constructor(limit = SUBREQUEST_BUDGET) {
		this.#left = limit;
	}

	get remaining(): number {
		return this.#left;
	}

	take(count = 1): boolean {
		if (this.#left < count) return false;
		this.#left -= count;
		return true;
	}
}

export interface Scope {
	env: Env;
	exec: Pick<ExecutionContext, 'waitUntil'>;
	budget: Budget;
	/** Public origin of this server, e.g. `https://media.example.com`. */
	origin: string;
}

export function createScope(env: Env, exec: Pick<ExecutionContext, 'waitUntil'>, url: URL): Scope {
	return { env, exec, budget: new Budget(), origin: url.origin };
}

export class UpstreamError extends Error {
	constructor(
		readonly url: string,
		message: string
	) {
		super(message);
		this.name = 'UpstreamError';
	}
}

export class BudgetExhausted extends UpstreamError {
	constructor(url: string) {
		super(url, 'Subrequest budget exhausted');
		this.name = 'BudgetExhausted';
	}
}

interface MemoEntry {
	value: unknown;
	storedAt: number;
}

const MEMO_LIMIT = 1000;
const memoStore = new Map<string, MemoEntry>();

/** Per-isolate cache. Isolates are reused across requests, so this absorbs most repeat lookups for free. */
export const memo = {
	get<T>(key: string, maxAgeMs: number): { value: T; fresh: boolean } | undefined {
		const entry = memoStore.get(key);
		if (!entry) return undefined;
		return { value: entry.value as T, fresh: Date.now() - entry.storedAt < maxAgeMs };
	},
	set(key: string, value: unknown): void {
		memoStore.delete(key);
		memoStore.set(key, { value, storedAt: Date.now() });
		if (memoStore.size > MEMO_LIMIT) {
			const oldest = memoStore.keys().next().value;
			if (oldest !== undefined) memoStore.delete(oldest);
		}
	},
	delete(key: string): void {
		memoStore.delete(key);
	},
	clear(): void {
		memoStore.clear();
	}
};

export interface FetchJsonOptions {
	/** Edge cache TTL in seconds; 0 disables caching. */
	ttl: number;
	timeoutMs: number;
	init?: RequestInit;
}

/**
 * Budgeted JSON fetch with an isolate cache in front and Cloudflare's edge cache behind (`cf.cacheTtl`).
 * Serves a stale isolate copy when the upstream fails.
 */
export async function fetchJson<T>(
	scope: Scope,
	url: string,
	options: FetchJsonOptions
): Promise<T> {
	const cached = options.ttl > 0 ? memo.get<T>(url, options.ttl * 1000) : undefined;
	if (cached?.fresh) return cached.value;

	if (!scope.budget.take()) {
		if (cached) return cached.value;
		throw new BudgetExhausted(url);
	}

	try {
		const response = await fetch(url, {
			...options.init,
			headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...options.init?.headers },
			signal: AbortSignal.timeout(options.timeoutMs),
			cf: options.ttl > 0 ? { cacheTtl: options.ttl, cacheEverything: true } : undefined
		});
		if (!response.ok) throw new UpstreamError(url, `HTTP ${response.status}`);
		const value = (await response.json()) as T;
		if (options.ttl > 0) memo.set(url, value);
		return value;
	} catch (error) {
		if (cached) return cached.value;
		if (error instanceof UpstreamError) throw error;
		const message = error instanceof Error ? error.message : String(error);
		throw new UpstreamError(url, message);
	}
}
