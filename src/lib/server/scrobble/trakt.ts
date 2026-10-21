import { USER_AGENT } from '../scope';
import type {
	DeviceCode,
	MediaRef,
	PlaybackEntry,
	PollResult,
	ProviderCredentials,
	ProviderDefinition,
	ProviderTokens,
	ScrobbleEvent,
	ScrobbleProvider,
	ShowProgress
} from './types';

const API = 'https://api.trakt.tv';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const REFRESH_MARGIN = 24 * 3600 * 1000;

interface TraktIds {
	imdb?: string | null;
	tmdb?: number | null;
}

interface TokenResponse {
	access_token: string;
	refresh_token: string;
	created_at: number;
	expires_in: number;
}

function headers(clientId: string, accessToken?: string): HeadersInit {
	return {
		'content-type': 'application/json',
		'user-agent': USER_AGENT,
		'trakt-api-version': '2',
		'trakt-api-key': clientId,
		...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
	};
}

function toTokens(body: TokenResponse): ProviderTokens {
	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token,
		expiresAt: (body.created_at + body.expires_in) * 1000
	};
}

function ids(ref: Pick<MediaRef, 'imdb' | 'tmdb'>): TraktIds {
	return {
		...(ref.imdb ? { imdb: ref.imdb } : {}),
		...(ref.tmdb ? { tmdb: Number(ref.tmdb) } : {})
	};
}

function fromIds(value: TraktIds | undefined): Pick<MediaRef, 'imdb' | 'tmdb'> {
	return {
		...(value?.imdb ? { imdb: value.imdb } : {}),
		...(value?.tmdb ? { tmdb: String(value.tmdb) } : {})
	};
}

/** Body shape shared by scrobble and history endpoints. */
export function traktBody(ref: MediaRef): Record<string, unknown> {
	if (ref.type === 'movie') return { movie: { ids: ids(ref) } };
	return { show: { ids: ids(ref) }, episode: { season: ref.season, number: ref.episode } };
}

function historyBody(ref: MediaRef): Record<string, unknown> {
	if (ref.type === 'movie') return { movies: [{ ids: ids(ref) }] };
	return {
		shows: [
			{ ids: ids(ref), seasons: [{ number: ref.season, episodes: [{ number: ref.episode }] }] }
		]
	};
}

class TraktProvider implements ScrobbleProvider {
	constructor(
		private readonly credentials: ProviderCredentials,
		private tokens: ProviderTokens,
		private readonly onTokens: (tokens: ProviderTokens) => Promise<void>,
		private readonly fetcher: typeof fetch
	) {}

	private async refresh(): Promise<void> {
		const response = await this.fetcher(`${API}/oauth/token`, {
			method: 'POST',
			headers: headers(this.credentials.clientId),
			body: JSON.stringify({
				refresh_token: this.tokens.refreshToken,
				client_id: this.credentials.clientId,
				client_secret: this.credentials.clientSecret,
				redirect_uri: REDIRECT_URI,
				grant_type: 'refresh_token'
			})
		});
		if (!response.ok) throw new Error(`Trakt token refresh failed: HTTP ${response.status}`);
		this.tokens = toTokens(await response.json());
		await this.onTokens(this.tokens);
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		if (this.tokens.expiresAt - Date.now() < REFRESH_MARGIN) await this.refresh();
		const send = () =>
			this.fetcher(`${API}${path}`, {
				method,
				headers: headers(this.credentials.clientId, this.tokens.accessToken),
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		let response = await send();
		if (response.status === 401) {
			await this.refresh();
			response = await send();
		}
		// 409 means the same scrobble was already recorded in the last hour.
		if (response.status === 409) return undefined as T;
		if (!response.ok) throw new Error(`Trakt ${method} ${path}: HTTP ${response.status}`);
		return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
	}

	async scrobble(event: ScrobbleEvent, ref: MediaRef, progress: number): Promise<void> {
		await this.request('POST', `/scrobble/${event}`, {
			...traktBody(ref),
			progress: Math.min(100, Math.max(0, Math.round(progress * 100) / 100))
		});
	}

	async setWatched(ref: MediaRef, watched: boolean): Promise<void> {
		await this.request(
			'POST',
			watched ? '/sync/history' : '/sync/history/remove',
			historyBody(ref)
		);
	}

	async playback(): Promise<PlaybackEntry[]> {
		const items = await this.request<
			{
				progress: number;
				paused_at: string;
				type: 'movie' | 'episode';
				movie?: { ids: TraktIds };
				show?: { ids: TraktIds };
				episode?: { season: number; number: number };
			}[]
		>('GET', '/sync/playback?limit=30');
		return items
			.map((item): PlaybackEntry | null => {
				if (item.type === 'movie' && item.movie) {
					return {
						ref: { type: 'movie', ...fromIds(item.movie.ids) },
						progress: item.progress,
						pausedAt: item.paused_at
					};
				}
				if (item.type === 'episode' && item.show && item.episode) {
					return {
						ref: {
							type: 'episode',
							...fromIds(item.show.ids),
							season: item.episode.season,
							episode: item.episode.number
						},
						progress: item.progress,
						pausedAt: item.paused_at
					};
				}
				return null;
			})
			.filter((entry): entry is PlaybackEntry => entry !== null)
			.sort((a, b) => b.pausedAt.localeCompare(a.pausedAt));
	}

	async watchedMovies(): Promise<Set<string>> {
		const items = await this.request<{ movie: { ids: TraktIds } }[]>('GET', '/sync/watched/movies');
		const keys = new Set<string>();
		for (const { movie } of items) {
			if (movie.ids.imdb) keys.add(`imdb:${movie.ids.imdb}`);
			if (movie.ids.tmdb) keys.add(`tmdb:${movie.ids.tmdb}`);
		}
		return keys;
	}

	async showProgress(show: MediaRef): Promise<ShowProgress> {
		const id = show.imdb ?? show.tmdb;
		if (!id) return { watched: new Set(), next: null };
		// Trakt resolves IMDb ids directly; TMDB ids need a lookup.
		let traktId: string = id;
		if (!show.imdb && show.tmdb) {
			const found = await this.request<{ show: { ids: { trakt: number } } }[]>(
				'GET',
				`/search/tmdb/${show.tmdb}?type=show`
			);
			if (!found[0]) return { watched: new Set(), next: null };
			traktId = String(found[0].show.ids.trakt);
		}
		const body = await this.request<{
			seasons?: { number: number; episodes: { number: number; completed: boolean }[] }[];
			next_episode?: { season: number; number: number } | null;
		}>('GET', `/shows/${encodeURIComponent(traktId)}/progress/watched?hidden=false&specials=false`);
		const watched = new Set<string>();
		for (const season of body.seasons ?? []) {
			for (const episode of season.episodes) {
				if (episode.completed) watched.add(`${season.number}:${episode.number}`);
			}
		}
		const next = body.next_episode
			? { season: body.next_episode.season, episode: body.next_episode.number }
			: null;
		return { watched, next };
	}

	async recentShows(limit: number): Promise<MediaRef[]> {
		const history = await this.request<{ show: { ids: TraktIds & { trakt: number } } }[]>(
			'GET',
			'/sync/history/episodes?limit=50'
		);
		const seen = new Set<number>();
		const shows: MediaRef[] = [];
		for (const { show } of history) {
			if (seen.has(show.ids.trakt)) continue;
			seen.add(show.ids.trakt);
			const ref: MediaRef = { type: 'show', ...fromIds(show.ids) };
			if (ref.imdb || ref.tmdb) shows.push(ref);
			if (shows.length >= limit) break;
		}
		return shows;
	}
}

export const trakt: ProviderDefinition = {
	id: 'trakt',
	name: 'Trakt',
	notice:
		'Creating a Trakt API application requires Trakt VIP since August 2026, and free accounts can connect only one third-party app at a time.',
	credentialsUrl: 'https://trakt.tv/oauth/applications/new',

	async startDeviceAuth(credentials): Promise<DeviceCode> {
		const response = await fetch(`${API}/oauth/device/code`, {
			method: 'POST',
			headers: headers(credentials.clientId),
			body: JSON.stringify({ client_id: credentials.clientId })
		});
		if (!response.ok) throw new Error(`Trakt rejected the client id (HTTP ${response.status})`);
		const body = (await response.json()) as {
			device_code: string;
			user_code: string;
			verification_url: string;
			expires_in: number;
			interval: number;
		};
		return {
			deviceCode: body.device_code,
			userCode: body.user_code,
			verificationUrl: body.verification_url,
			expiresIn: body.expires_in,
			interval: body.interval
		};
	},

	async pollDeviceAuth(credentials, deviceCode): Promise<PollResult> {
		const response = await fetch(`${API}/oauth/device/token`, {
			method: 'POST',
			headers: headers(credentials.clientId),
			body: JSON.stringify({
				code: deviceCode,
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret
			})
		});
		switch (response.status) {
			case 200: {
				const tokens = toTokens(await response.json());
				const settings = await fetch(`${API}/users/settings`, {
					headers: headers(credentials.clientId, tokens.accessToken)
				});
				const username = settings.ok
					? (((await settings.json()) as { user?: { username?: string } }).user?.username ?? null)
					: null;
				return { status: 'approved', tokens, username };
			}
			case 400:
				return { status: 'pending' };
			case 429:
				return { status: 'slow_down' };
			case 410:
				return { status: 'expired' };
			case 418:
				return { status: 'denied' };
			default:
				return { status: 'invalid' };
		}
	},

	create(credentials, tokens, onTokens, fetcher) {
		return new TraktProvider(credentials, tokens, onTokens, fetcher);
	}
};
