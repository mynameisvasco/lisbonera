import { libraryPage } from '../jellyfin/media';
import type { Scope } from '../scope';
import type { Library } from '../store';

export interface PosterPreview {
	id: string;
	name: string;
	poster: string | null;
	year: string;
}

/** First titles of each library, for the dashboard. Catalog pages are cached, so this is cheap after the first view. */
export async function libraryPreviews(
	scope: Scope,
	libraries: Library[],
	count: number
): Promise<Record<string, PosterPreview[]>> {
	const entries = await Promise.all(
		libraries.map(async (library) => {
			try {
				const page = await libraryPage(scope, library, 0, count);
				return [
					library.id,
					page.items.map(({ meta }) => ({
						id: meta.id,
						name: meta.name,
						poster: meta.poster ?? null,
						year: String(meta.releaseInfo ?? meta.year ?? '').slice(0, 4)
					}))
				] as const;
			} catch {
				return [library.id, []] as const;
			}
		})
	);
	return Object.fromEntries(entries);
}
