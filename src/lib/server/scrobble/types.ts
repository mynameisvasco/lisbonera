/** A title as scrobble services know it. For episodes the ids are the show's ids. */
export interface MediaRef {
	type: 'movie' | 'episode' | 'show';
	imdb?: string;
	tmdb?: string;
	season?: number;
	episode?: number;
}

export interface PlaybackEntry {
	ref: MediaRef;
	/** Percentage, 0–100. */
	progress: number;
	pausedAt: string;
}

export interface ShowProgress {
	/** Keys `${season}:${episode}`. */
	watched: Set<string>;
	next: { season: number; episode: number } | null;
}

export interface ProviderTokens {
	accessToken: string;
	refreshToken: string;
	/** Epoch milliseconds. */
	expiresAt: number;
}

export interface ProviderCredentials {
	clientId: string;
	clientSecret: string;
}

export interface DeviceCode {
	deviceCode: string;
	userCode: string;
	verificationUrl: string;
	expiresIn: number;
	interval: number;
}

export type PollResult =
	| { status: 'approved'; tokens: ProviderTokens; username: string | null }
	| { status: 'pending' | 'slow_down' | 'expired' | 'denied' | 'invalid' };

export type ScrobbleEvent = 'start' | 'pause' | 'stop';

export interface ScrobbleProvider {
	scrobble(event: ScrobbleEvent, ref: MediaRef, progress: number): Promise<void>;
	setWatched(ref: MediaRef, watched: boolean): Promise<void>;
	/** In-progress items, most recent first. */
	playback(): Promise<PlaybackEntry[]>;
	/** Keys `imdb:tt…` and `tmdb:…` of watched movies. */
	watchedMovies(): Promise<Set<string>>;
	showProgress(show: MediaRef): Promise<ShowProgress>;
	/** Shows with recent activity, most recent first. */
	recentShows(limit: number): Promise<MediaRef[]>;
}

export interface ProviderDefinition {
	id: string;
	name: string;
	/** Shown in the dashboard next to the provider. */
	notice?: string;
	credentialsUrl: string;
	startDeviceAuth(credentials: ProviderCredentials): Promise<DeviceCode>;
	pollDeviceAuth(credentials: ProviderCredentials, deviceCode: string): Promise<PollResult>;
	create(
		credentials: ProviderCredentials,
		tokens: ProviderTokens,
		onTokens: (tokens: ProviderTokens) => Promise<void>,
		fetcher: typeof fetch
	): ScrobbleProvider;
}

export function mediaKey(ref: Pick<MediaRef, 'imdb' | 'tmdb'>): string[] {
	const keys: string[] = [];
	if (ref.imdb) keys.push(`imdb:${ref.imdb}`);
	if (ref.tmdb) keys.push(`tmdb:${ref.tmdb}`);
	return keys;
}
