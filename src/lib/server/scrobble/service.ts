import { decrypt, encrypt } from '../crypto';
import type { IdEntry } from '../ids';
import { BudgetExhausted, memo, type Scope } from '../scope';
import { getSetting, setSetting } from '../store';
import { trakt } from './trakt';
import type {
	MediaRef,
	PlaybackEntry,
	ProviderCredentials,
	ProviderDefinition,
	ProviderTokens,
	ScrobbleProvider,
	ShowProgress
} from './types';

export const providers: ProviderDefinition[] = [trakt];

const ACCOUNT_TTL = 60 * 1000;
const READ_TTL = 5 * 60 * 1000;

export function getProviderDefinition(id: string): ProviderDefinition | null {
	return providers.find((provider) => provider.id === id) ?? null;
}

export interface ScrobbleAccount {
	provider: string;
	username: string | null;
	active: boolean;
	lastError: string | null;
	updatedAt: number;
}

interface AccountRow {
	provider: string;
	tokens: string;
	username: string | null;
	active: number;
	last_error: string | null;
	updated_at: number;
}

export function toMediaRef(
	entry: Pick<IdEntry, 'kind' | 'stremioId' | 'season' | 'episode'>
): MediaRef | null {
	const ids: Pick<MediaRef, 'imdb' | 'tmdb'> = {};
	if (/^tt\d+$/.test(entry.stremioId)) ids.imdb = entry.stremioId;
	else if (/^tmdb:\d+$/.test(entry.stremioId)) ids.tmdb = entry.stremioId.slice(5);
	else return null;

	if (entry.kind === 'movie') return { type: 'movie', ...ids };
	if (entry.kind === 'series') return { type: 'show', ...ids };
	if (entry.kind === 'episode' && entry.season !== null && entry.episode !== null) {
		return { type: 'episode', ...ids, season: entry.season, episode: entry.episode };
	}
	return null;
}

function credentialsKey(provider: string): string {
	return `scrobble:${provider}:credentials`;
}

export async function saveCredentials(
	env: Env,
	provider: string,
	credentials: ProviderCredentials
): Promise<void> {
	await setSetting(
		env.DB,
		credentialsKey(provider),
		await encrypt(env.ENCRYPTION_KEY, JSON.stringify(credentials))
	);
}

export async function loadCredentials(
	env: Env,
	provider: string
): Promise<ProviderCredentials | null> {
	const stored = await getSetting(env.DB, credentialsKey(provider));
	if (!stored) return null;
	try {
		return JSON.parse(await decrypt(env.ENCRYPTION_KEY, stored)) as ProviderCredentials;
	} catch {
		return null;
	}
}

export async function listAccounts(db: D1Database): Promise<ScrobbleAccount[]> {
	const { results } = await db.prepare('SELECT * FROM scrobble_accounts').all<AccountRow>();
	return results.map((row) => ({
		provider: row.provider,
		username: row.username,
		active: row.active === 1,
		lastError: row.last_error,
		updatedAt: row.updated_at
	}));
}

/** Connecting a provider makes it the only active one. */
export async function saveAccount(
	env: Env,
	provider: string,
	tokens: ProviderTokens,
	username: string | null
): Promise<void> {
	const encrypted = await encrypt(env.ENCRYPTION_KEY, JSON.stringify(tokens));
	await env.DB.batch([
		env.DB.prepare('UPDATE scrobble_accounts SET active = 0'),
		env.DB.prepare(
			`INSERT INTO scrobble_accounts (provider, tokens, username, active, last_error, updated_at)
			VALUES (?, ?, ?, 1, NULL, ?)
			ON CONFLICT (provider) DO UPDATE SET tokens = excluded.tokens, username = excluded.username,
				active = 1, last_error = NULL, updated_at = excluded.updated_at`
		).bind(provider, encrypted, username, Date.now())
	]);
	memo.clear();
}

export async function setActive(db: D1Database, provider: string, active: boolean): Promise<void> {
	await db.batch([
		...(active ? [db.prepare('UPDATE scrobble_accounts SET active = 0')] : []),
		db
			.prepare('UPDATE scrobble_accounts SET active = ? WHERE provider = ?')
			.bind(active ? 1 : 0, provider)
	]);
	memo.clear();
}

export async function disconnect(db: D1Database, provider: string): Promise<void> {
	await db.prepare('DELETE FROM scrobble_accounts WHERE provider = ?').bind(provider).run();
	memo.clear();
}

async function recordError(db: D1Database, provider: string, error: unknown): Promise<void> {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`scrobble ${provider}: ${message}`);
	await db
		.prepare('UPDATE scrobble_accounts SET last_error = ? WHERE provider = ?')
		.bind(message.slice(0, 500), provider)
		.run()
		.catch(() => undefined);
}

interface ActiveAccount {
	definition: ProviderDefinition;
	credentials: ProviderCredentials;
	tokens: ProviderTokens;
}

async function loadActive(env: Env): Promise<ActiveAccount | null> {
	const cached = memo.get<ActiveAccount | null>('scrobble:active', ACCOUNT_TTL);
	if (cached?.fresh) return cached.value;

	let active: ActiveAccount | null = null;
	const row = await env.DB.prepare(
		'SELECT * FROM scrobble_accounts WHERE active = 1'
	).first<AccountRow>();
	const definition = row ? getProviderDefinition(row.provider) : null;
	if (row && definition) {
		const credentials = await loadCredentials(env, row.provider);
		try {
			const tokens = JSON.parse(await decrypt(env.ENCRYPTION_KEY, row.tokens)) as ProviderTokens;
			if (credentials) active = { definition, credentials, tokens };
		} catch {
			active = null;
		}
	}
	memo.set('scrobble:active', active);
	return active;
}

export interface ActiveScrobbler {
	id: string;
	provider: ScrobbleProvider;
}

export async function activeScrobbler(scope: Scope): Promise<ActiveScrobbler | null> {
	const account = await loadActive(scope.env);
	if (!account) return null;
	const fetcher: typeof fetch = (input, init) => {
		if (!scope.budget.take()) return Promise.reject(new BudgetExhausted(String(input)));
		return fetch(input, init);
	};
	const provider = account.definition.create(
		account.credentials,
		account.tokens,
		async (tokens) => {
			account.tokens = tokens;
			await scope.env.DB.prepare(
				'UPDATE scrobble_accounts SET tokens = ?, updated_at = ? WHERE provider = ?'
			)
				.bind(
					await encrypt(scope.env.ENCRYPTION_KEY, JSON.stringify(tokens)),
					Date.now(),
					account.definition.id
				)
				.run();
		},
		fetcher
	);
	return { id: account.definition.id, provider };
}

/** Runs a provider read through the isolate cache; failures degrade to `fallback` and are shown in the dashboard. */
async function cachedRead<T>(
	scope: Scope,
	key: string,
	fallback: T,
	read: (provider: ScrobbleProvider) => Promise<T>
): Promise<T> {
	const scrobbler = await activeScrobbler(scope);
	if (!scrobbler) return fallback;
	const memoKey = `scrobble:${scrobbler.id}:${key}`;
	const cached = memo.get<T>(memoKey, READ_TTL);
	if (cached?.fresh) return cached.value;
	try {
		const value = await read(scrobbler.provider);
		memo.set(memoKey, value);
		return value;
	} catch (error) {
		if (!(error instanceof BudgetExhausted))
			scope.exec.waitUntil(recordError(scope.env.DB, scrobbler.id, error));
		return cached?.value ?? fallback;
	}
}

export function watchedMovies(scope: Scope): Promise<Set<string>> {
	return cachedRead(scope, 'movies', new Set<string>(), (provider) => provider.watchedMovies());
}

export function playback(scope: Scope): Promise<PlaybackEntry[]> {
	return cachedRead(scope, 'playback', [], (provider) => provider.playback());
}

export function showProgress(scope: Scope, show: MediaRef): Promise<ShowProgress | null> {
	return cachedRead<ShowProgress | null>(
		scope,
		`show:${show.imdb ?? show.tmdb}`,
		null,
		(provider) => provider.showProgress(show)
	);
}

export function recentShows(scope: Scope, limit: number): Promise<MediaRef[]> {
	return cachedRead(scope, `recent:${limit}`, [], (provider) => provider.recentShows(limit));
}

/** Clears cached reads so the next request reflects a change the user just made. */
export function invalidateReads(ref?: MediaRef): void {
	for (const provider of providers) {
		memo.delete(`scrobble:${provider.id}:movies`);
		memo.delete(`scrobble:${provider.id}:playback`);
		if (ref) memo.delete(`scrobble:${provider.id}:show:${ref.imdb ?? ref.tmdb}`);
	}
}

export async function runScrobble(
	scope: Scope,
	action: (provider: ScrobbleProvider) => Promise<void>
): Promise<void> {
	const scrobbler = await activeScrobbler(scope);
	if (!scrobbler) return;
	try {
		await action(scrobbler.provider);
	} catch (error) {
		await recordError(scope.env.DB, scrobbler.id, error);
	}
}
