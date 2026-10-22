import type { Addon } from '../stremio/types';
import { catalogExtras } from '../stremio/client';

export interface GenreCatalog {
	/** `${addonId}|${type}|${catalogId}`, the value the dashboard sends back. */
	key: string;
	addonId: string;
	addonName: string;
	type: 'movie' | 'series';
	catalogId: string;
	name: string;
	genres: string[];
}

/**
 * Catalogs that list their genre options and need nothing else to browse. Each genre can back a collection,
 * which is how categories (Action, Comedy…) are built from addons such as Cinemeta or AIOMetadata.
 */
export function genreCatalogs(addons: Addon[]): GenreCatalog[] {
	return addons.flatMap((addon) => {
		if (!addon.enabled || !addon.manifest) return [];
		return addon.manifest.catalogs.flatMap((catalog) => {
			if (catalog.type !== 'movie' && catalog.type !== 'series') return [];
			const genres = catalog.extra?.find((extra) => extra.name === 'genre')?.options ?? [];
			const { required } = catalogExtras(catalog);
			const browsable = [...required].every((name) => name === 'skip' || name === 'genre');
			if (genres.length === 0 || !browsable) return [];
			return [
				{
					key: `${addon.id}|${catalog.type}|${catalog.id}`,
					addonId: addon.id,
					addonName: addon.manifest!.name,
					type: catalog.type,
					catalogId: catalog.id,
					name: catalog.name ?? catalog.id,
					genres: [...new Set(genres.filter((genre) => typeof genre === 'string' && genre))]
				}
			];
		});
	});
}
