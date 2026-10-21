/** Subset of the Stremio addon protocol: https://github.com/Stremio/stremio-addon-sdk/tree/master/docs/api */

export type StremioType = 'movie' | 'series';

export interface ManifestResource {
	name: string;
	types?: string[];
	idPrefixes?: string[];
}

export interface ManifestExtra {
	name: string;
	isRequired?: boolean;
	options?: string[];
}

export interface ManifestCatalog {
	type: string;
	id: string;
	name?: string;
	extra?: ManifestExtra[];
	extraSupported?: string[];
	extraRequired?: string[];
}

export interface Manifest {
	id: string;
	name: string;
	version: string;
	description?: string;
	logo?: string;
	types: string[];
	idPrefixes?: string[];
	resources: (string | ManifestResource)[];
	catalogs: ManifestCatalog[];
	behaviorHints?: { configurable?: boolean; configurationRequired?: boolean };
}

export interface MetaPreview {
	id: string;
	type: string;
	name: string;
	poster?: string;
	background?: string;
	logo?: string;
	description?: string;
	releaseInfo?: string | number;
	year?: string | number;
	imdbRating?: string | number;
	genres?: string[];
	genre?: string[];
	runtime?: string;
}

export interface Video {
	id: string;
	title?: string;
	name?: string;
	season?: number;
	episode?: number;
	number?: number;
	released?: string;
	firstAired?: string;
	overview?: string;
	description?: string;
	thumbnail?: string;
}

export interface Meta extends MetaPreview {
	videos?: Video[];
	released?: string;
	cast?: string[];
	director?: string[] | string;
	status?: string;
	imdb_id?: string;
	moviedb_id?: number | string;
	behaviorHints?: { defaultVideoId?: string };
}

export interface Stream {
	url?: string;
	ytId?: string;
	infoHash?: string;
	externalUrl?: string;
	name?: string;
	title?: string;
	description?: string;
	behaviorHints?: {
		bingeGroup?: string;
		notWebReady?: boolean;
		proxyHeaders?: unknown;
		filename?: string;
		videoSize?: number;
	};
}

export interface Addon {
	id: string;
	url: string;
	manifest: Manifest | null;
	enabled: boolean;
	position: number;
	lastError: string | null;
	checkedAt: number | null;
}
