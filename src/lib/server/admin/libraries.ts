import { tag } from '../jellyfin/dto';
import { UPLOAD_PREFIX, type CollectionSource, type Library } from '../store';
import type { Addon } from '../stremio/types';

export type LibraryOrigin = 'catalog' | 'manual' | 'sourced';

export interface SourceSummary {
	kind: CollectionSource['kind'];
	label: string;
	href: string | null;
}

/** What the dashboard shows about a library, whatever its kind. */
export function describeLibrary(library: Library, addons: Addon[]) {
	const addonName = (id: string | null) => {
		const addon = addons.find((item) => item.id === id);
		return addon ? (addon.manifest?.name ?? new URL(addon.url).host) : 'Removed addon';
	};
	const sources: SourceSummary[] = library.sources.map((source) => {
		switch (source.kind) {
			case 'catalog':
				return {
					kind: source.kind,
					label: `${addonName(source.addonId)}${source.genre ? ` · ${source.genre}` : ''}`,
					href: null
				};
			case 'mdblist':
				return {
					kind: source.kind,
					label: `MDBList · ${source.list}`,
					href: /^\d+$/.test(source.list) ? null : `https://mdblist.com/lists/${source.list}`
				};
			case 'trakt':
				return {
					kind: source.kind,
					label: `Trakt · ${source.name ?? source.slug}`,
					href: `https://trakt.tv/users/${source.user}/lists/${source.slug}`
				};
		}
	});
	const origin: LibraryOrigin =
		library.kind === 'catalog' ? 'catalog' : sources.length ? 'sourced' : 'manual';
	const kinds = new Set(sources.map((source) => source.kind));
	const summary =
		origin === 'catalog'
			? addonName(library.addonId)
			: origin === 'manual'
				? 'Hand-picked'
				: sources.length === 1
					? sources[0].label
					: kinds.size === 1
						? `${{ catalog: 'Addon', mdblist: 'MDBList', trakt: 'Trakt' }[sources[0].kind]} · ${sources.length} lists`
						: `${sources.length} sources`;
	return {
		id: library.id,
		name: library.name,
		kind: library.kind,
		origin,
		type: library.catalogType,
		source: summary,
		sources,
		enabled: library.enabled,
		// Uploads are served by the dashboard; linked artwork is shown from its own URL.
		image: library.image?.startsWith(UPLOAD_PREFIX)
			? `/admin/libraries/${library.id}/artwork?v=${tag(library.image)}`
			: library.image,
		imageAspect: library.imageAspect
	};
}
