import type {
	BaseItemDto,
	MediaSourceInfo,
	UserDto,
	UserItemDataDto
} from '@jellyfin/sdk/lib/generated-client/models';
import type { IdEntry } from '../ids';
import type { Library } from '../store';
import type { Meta, MetaPreview, Video } from '../stremio/types';

export const SERVER_NAME = 'Lisbonera';
export const SERVER_VERSION = '10.11.0';
export const PRODUCT_NAME = 'Jellyfin Server';
const TICKS_PER_MINUTE = 60 * 10_000_000;
const EPOCH = '2026-01-01T00:00:00.0000000Z';

export interface DtoContext {
	serverId: string;
	userId: string;
}

export interface UserState {
	played: boolean;
	/** Percentage, 0–100. */
	progress?: number;
	/** Unwatched children of a series or season. */
	unplayed?: number;
}

/** FNV-1a; image tags only need to change when the URL changes. */
export function tag(value: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Stremio runtimes look like `142 min`, `2h 22min` or `45`. */
export function runtimeTicks(runtime: string | undefined): number | null {
	if (!runtime) return null;
	const hours = /(\d+)\s*h/i.exec(runtime)?.[1];
	const minutes = /(\d+)\s*m/i.exec(runtime)?.[1];
	let total = Number(hours ?? 0) * 60 + Number(minutes ?? 0);
	if (!hours && !minutes && /^\s*\d+\s*$/.test(runtime)) total = Number(runtime);
	return total > 0 ? total * TICKS_PER_MINUTE : null;
}

export function productionYear(meta: MetaPreview): number | undefined {
	const raw = String(meta.year ?? meta.releaseInfo ?? '');
	const year = Number.parseInt(raw.slice(0, 4), 10);
	return Number.isFinite(year) && year > 1800 ? year : undefined;
}

function isoDate(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function providerIds(stremioId: string, meta?: Meta | MetaPreview): Record<string, string> {
	const ids: Record<string, string> = {};
	if (/^tt\d+$/.test(stremioId)) ids.Imdb = stremioId;
	else if (meta && 'imdb_id' in meta && meta.imdb_id) ids.Imdb = meta.imdb_id;
	if (/^tmdb:\d+$/.test(stremioId)) ids.Tmdb = stremioId.slice(5);
	else if (meta && 'moviedb_id' in meta && meta.moviedb_id) ids.Tmdb = String(meta.moviedb_id);
	return ids;
}

/** Readable stand-in for `Path`. Infuse derives display titles from it, so it must never be a URL. */
function virtualPath(name: string, year?: number): string {
	const clean = name.replace(/[\\/:*?"<>|]+/g, ' ').trim();
	return year ? `${clean} (${year})` : clean;
}

function userData(
	key: string,
	itemId: string,
	state: UserState | undefined,
	runtime: number | null
): UserItemDataDto {
	const progress = state?.progress ?? 0;
	return {
		Key: key,
		ItemId: itemId,
		PlaybackPositionTicks:
			runtime && progress > 0 && !state?.played ? Math.round((runtime * progress) / 100) : 0,
		PlayedPercentage: progress > 0 && !state?.played ? progress : null,
		PlayCount: state?.played ? 1 : 0,
		IsFavorite: false,
		Played: state?.played ?? false,
		...(state?.unplayed !== undefined ? { UnplayedItemCount: state.unplayed } : {})
	};
}

function base(ctx: DtoContext, id: string, name: string): BaseItemDto {
	return {
		Name: name,
		ServerId: ctx.serverId,
		Id: id,
		Etag: tag(id + name),
		DateCreated: EPOCH,
		CanDelete: false,
		CanDownload: true,
		SortName: name.toLowerCase().replace(/^(the|a|an)\s+/, ''),
		ExternalUrls: [],
		Taglines: [],
		Genres: [],
		RemoteTrailers: [],
		People: [],
		Studios: [],
		GenreItems: [],
		Tags: [],
		LockedFields: [],
		LockData: false,
		LocalTrailerCount: 0,
		SpecialFeatureCount: 0,
		PlayAccess: 'Full',
		EnableMediaSourceDisplay: true,
		DisplayPreferencesId: id,
		ImageTags: {},
		BackdropImageTags: [],
		ImageBlurHashes: {},
		LocationType: 'Remote'
	};
}

function images(item: BaseItemDto, entry: Pick<IdEntry, 'poster' | 'background' | 'logo'>): void {
	if (entry.poster) {
		item.ImageTags = { ...item.ImageTags, Primary: tag(entry.poster) };
		item.PrimaryImageAspectRatio = 2 / 3;
	}
	if (entry.logo) item.ImageTags = { ...item.ImageTags, Logo: tag(entry.logo) };
	if (entry.background) item.BackdropImageTags = [tag(entry.background)];
}

function describe(item: BaseItemDto, meta: Meta | MetaPreview, stremioId: string): void {
	const genres = meta.genres ?? meta.genre ?? [];
	item.Overview = meta.description;
	item.Genres = genres;
	item.GenreItems = genres.map((name) => ({
		Name: name,
		Id: tag(`genre|${name}`).padEnd(32, '0')
	}));
	item.ProductionYear = productionYear(meta);
	item.PremiereDate = isoDate('released' in meta ? meta.released : undefined);
	const rating = Number.parseFloat(String(meta.imdbRating ?? ''));
	if (Number.isFinite(rating)) item.CommunityRating = rating;
	item.ProviderIds = providerIds(stremioId, meta);
	if ('cast' in meta && meta.cast) {
		item.People = meta.cast
			.slice(0, 15)
			.map((name) => ({ Name: name, Id: tag(`person|${name}`).padEnd(32, '0'), Type: 'Actor' }));
	}
}

export function movieItem(
	ctx: DtoContext,
	entry: IdEntry,
	meta: Meta | MetaPreview,
	state?: UserState
): BaseItemDto {
	const item = base(ctx, entry.guid, meta.name);
	describe(item, meta, entry.stremioId);
	images(item, entry);
	const runtime = entry.runtimeTicks ?? runtimeTicks(meta.runtime);
	return {
		...item,
		Type: 'Movie',
		IsFolder: false,
		MediaType: 'Video',
		VideoType: 'VideoFile',
		Path: virtualPath(meta.name, item.ProductionYear ?? undefined),
		RunTimeTicks: runtime,
		Chapters: [],
		UserData: userData(entry.stremioId, entry.guid, state, runtime)
	};
}

export function seriesItem(
	ctx: DtoContext,
	entry: IdEntry,
	meta: Meta | MetaPreview,
	state?: UserState,
	childCount?: number
): BaseItemDto {
	const item = base(ctx, entry.guid, meta.name);
	describe(item, meta, entry.stremioId);
	images(item, entry);
	const status = 'status' in meta && meta.status ? meta.status : undefined;
	return {
		...item,
		Type: 'Series',
		IsFolder: true,
		MediaType: 'Unknown',
		Path: virtualPath(meta.name),
		Status: status === 'Ended' ? 'Ended' : status ? 'Continuing' : undefined,
		AirDays: [],
		RunTimeTicks: runtimeTicks(meta.runtime),
		ChildCount: childCount,
		UserData: userData(entry.stremioId, entry.guid, state, null)
	};
}

export function seasonName(season: number): string {
	return season === 0 ? 'Specials' : `Season ${season}`;
}

export function seasonItem(
	ctx: DtoContext,
	entry: IdEntry,
	series: IdEntry,
	seriesName: string,
	episodeCount: number,
	state?: UserState
): BaseItemDto {
	const season = entry.season ?? 0;
	const item = base(ctx, entry.guid, seasonName(season));
	images(item, {
		poster: entry.poster ?? series.poster,
		background: series.background,
		logo: null
	});
	return {
		...item,
		Type: 'Season',
		IsFolder: true,
		MediaType: 'Unknown',
		IndexNumber: season,
		SortName: String(season).padStart(4, '0'),
		ParentId: series.guid,
		SeriesId: series.guid,
		SeriesName: seriesName,
		SeriesPrimaryImageTag: series.poster ? tag(series.poster) : undefined,
		ParentBackdropItemId: series.background ? series.guid : undefined,
		ParentBackdropImageTags: series.background ? [tag(series.background)] : undefined,
		ChildCount: episodeCount,
		ProviderIds: {},
		UserData: userData(`${series.stremioId}:${season}`, entry.guid, state, null)
	};
}

export function episodeItem(
	ctx: DtoContext,
	entry: IdEntry,
	series: IdEntry,
	seriesName: string,
	seasonGuid: string,
	video: Video,
	state?: UserState
): BaseItemDto {
	const season = entry.season ?? 0;
	const episode = entry.episode ?? 0;
	const name = video.name || video.title || `Episode ${episode}`;
	const item = base(ctx, entry.guid, name);
	images(item, { poster: video.thumbnail ?? null, background: null, logo: null });
	if (video.thumbnail) item.PrimaryImageAspectRatio = 16 / 9;
	const runtime = entry.runtimeTicks;
	return {
		...item,
		Type: 'Episode',
		IsFolder: false,
		MediaType: 'Video',
		VideoType: 'VideoFile',
		Path: virtualPath(
			`${seriesName} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
		),
		Overview: video.overview ?? video.description,
		PremiereDate: isoDate(video.released ?? video.firstAired),
		ProductionYear: isoDate(video.released)
			? new Date(video.released!).getUTCFullYear()
			: undefined,
		IndexNumber: episode,
		ParentIndexNumber: season,
		SortName: `${String(season).padStart(4, '0')}-${String(episode).padStart(4, '0')}`,
		ParentId: seasonGuid,
		SeasonId: seasonGuid,
		SeasonName: seasonName(season),
		SeriesId: series.guid,
		SeriesName: seriesName,
		SeriesPrimaryImageTag: series.poster ? tag(series.poster) : undefined,
		ParentBackdropItemId: series.background ? series.guid : undefined,
		ParentBackdropImageTags: series.background ? [tag(series.background)] : undefined,
		ParentThumbItemId: series.guid,
		ParentLogoItemId: series.logo ? series.guid : undefined,
		ParentLogoImageTag: series.logo ? tag(series.logo) : undefined,
		RunTimeTicks: runtime,
		Chapters: [],
		ProviderIds: {},
		UserData: userData(`${series.stremioId}:${season}:${episode}`, entry.guid, state, runtime)
	};
}

/** Mixed libraries have no collection type, which is how Jellyfin represents them too. */
export function collectionType(library: Library): 'movies' | 'tvshows' | undefined {
	if (library.catalogType === 'movie') return 'movies';
	if (library.catalogType === 'series') return 'tvshows';
	return undefined;
}

export function libraryItem(ctx: DtoContext, library: Library): BaseItemDto {
	return {
		...base(ctx, library.id, library.name),
		Type: 'CollectionFolder',
		CollectionType: collectionType(library),
		IsFolder: true,
		MediaType: 'Unknown',
		CanDownload: false,
		LocationType: 'FileSystem',
		Path: `/libraries/${library.id}`,
		ProviderIds: {},
		UserData: userData(library.id, library.id, undefined, null)
	};
}

export function mediaSource(
	source: { id: string; name: string; filename?: string; size?: number },
	path: string,
	runtime: number | null
): MediaSourceInfo {
	const container = source.filename?.split('.').pop()?.toLowerCase();
	return {
		Protocol: 'Http',
		Id: source.id,
		Path: path,
		Type: 'Default',
		Container: container && container.length <= 4 ? container : 'mkv',
		Size: source.size ?? null,
		Name: source.name,
		IsRemote: true,
		ETag: source.id,
		RunTimeTicks: runtime,
		ReadAtNativeFramerate: false,
		IgnoreDts: false,
		IgnoreIndex: false,
		GenPtsInput: false,
		SupportsTranscoding: false,
		SupportsDirectStream: true,
		SupportsDirectPlay: true,
		IsInfiniteStream: false,
		UseMostCompatibleTranscodingProfile: false,
		RequiresOpening: false,
		RequiresClosing: false,
		RequiresLooping: false,
		SupportsProbing: false,
		VideoType: 'VideoFile',
		MediaStreams: [],
		MediaAttachments: [],
		Formats: [],
		RequiredHttpHeaders: {},
		TranscodingSubProtocol: 'http',
		HasSegments: false
	};
}

export function userDto(ctx: DtoContext, username: string): UserDto {
	const now = new Date().toISOString();
	return {
		Name: username,
		ServerId: ctx.serverId,
		ServerName: SERVER_NAME,
		Id: ctx.userId,
		HasPassword: true,
		HasConfiguredPassword: true,
		HasConfiguredEasyPassword: false,
		EnableAutoLogin: false,
		LastLoginDate: now,
		LastActivityDate: now,
		Configuration: {
			AudioLanguagePreference: '',
			PlayDefaultAudioTrack: true,
			SubtitleLanguagePreference: '',
			DisplayMissingEpisodes: false,
			GroupedFolders: [],
			SubtitleMode: 'Default',
			DisplayCollectionsView: false,
			EnableLocalPassword: false,
			OrderedViews: [],
			LatestItemsExcludes: [],
			MyMediaExcludes: [],
			HidePlayedInLatest: true,
			RememberAudioSelections: true,
			RememberSubtitleSelections: true,
			EnableNextEpisodeAutoPlay: true,
			CastReceiverId: 'F007D354'
		},
		Policy: {
			IsAdministrator: false,
			IsHidden: false,
			EnableCollectionManagement: false,
			EnableSubtitleManagement: false,
			EnableLyricManagement: false,
			IsDisabled: false,
			BlockedTags: [],
			AllowedTags: [],
			EnableUserPreferenceAccess: true,
			AccessSchedules: [],
			BlockUnratedItems: [],
			EnableRemoteControlOfOtherUsers: false,
			EnableSharedDeviceControl: false,
			EnableRemoteAccess: true,
			EnableLiveTvManagement: false,
			EnableLiveTvAccess: false,
			EnableMediaPlayback: true,
			EnableAudioPlaybackTranscoding: false,
			EnableVideoPlaybackTranscoding: false,
			EnablePlaybackRemuxing: false,
			ForceRemoteSourceTranscoding: false,
			EnableContentDeletion: false,
			EnableContentDeletionFromFolders: [],
			EnableContentDownloading: true,
			EnableSyncTranscoding: false,
			EnableMediaConversion: false,
			EnabledDevices: [],
			EnableAllDevices: true,
			EnabledChannels: [],
			EnableAllChannels: true,
			EnabledFolders: [],
			EnableAllFolders: true,
			InvalidLoginAttemptCount: 0,
			LoginAttemptsBeforeLockout: -1,
			MaxActiveSessions: 0,
			EnablePublicSharing: false,
			BlockedMediaFolders: [],
			BlockedChannels: [],
			RemoteClientBitrateLimit: 0,
			AuthenticationProviderId:
				'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider',
			PasswordResetProviderId: 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider',
			SyncPlayAccess: 'None'
		}
	};
}
