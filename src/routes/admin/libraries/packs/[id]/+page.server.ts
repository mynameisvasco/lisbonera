import { env } from 'cloudflare:workers';
import { error, fail } from '@sveltejs/kit';
import { packs } from '#lib/packs.js';
import { genreCatalogs } from '#lib/server/admin/collections.js';
import {
	loadPack,
	matchGenre,
	normalizeName,
	PackError,
	planImport,
	type PackSourceMode
} from '#lib/server/admin/packs.js';
import { adminScope } from '#lib/server/admin/scope.js';
import {
	createCollections,
	listAddons,
	listLibraries,
	setLibraryImages
} from '#lib/server/store.js';
import { traktClientId } from '#lib/server/trakt-lists.js';
import type { Actions, PageServerLoad } from './$types';

/** A listed pack (its sourced variant when there is one, since it also carries the artwork), or `custom?url=`. */
function packSource(id: string, url: URL) {
	if (id === 'custom') {
		const custom = url.searchParams.get('url')?.trim() ?? '';
		if (!custom) error(400, 'Missing pack URL');
		return { listing: null, url: custom };
	}
	const listing = packs.find((pack) => pack.id === id);
	if (!listing) error(404, 'Pack not found');
	return { listing, url: (listing.sourcedUrl ?? listing.url)! };
}

export const load: PageServerLoad = async (event) => {
	const { listing, url } = packSource(event.params.id, event.url);
	const [addons, libraries, traktApp] = await Promise.all([
		listAddons(env.DB),
		listLibraries(env.DB),
		traktClientId(env)
	]);
	let items;
	try {
		items = await loadPack(adminScope(event), url);
	} catch (cause) {
		if (cause instanceof PackError) error(502, cause.message);
		throw cause;
	}
	const catalogs = genreCatalogs(addons);
	const byName = new Map(libraries.map((library) => [normalizeName(library.name), library.name]));
	return {
		listing,
		url,
		hasTraktApp: traktApp !== null,
		catalogs: catalogs.map(({ key, addonName, name, type }) => ({ key, addonName, name, type })),
		items: items.map((item, index) => ({
			index,
			name: item.name,
			image: item.image,
			shape: item.shape,
			lists: item.lists.map((list) => list.name),
			existing: byName.get(normalizeName(item.name)) ?? null,
			genres: Object.fromEntries(
				catalogs.map((catalog) => [catalog.key, matchGenre(item.name, catalog.genres)])
			)
		}))
	};
};

export const actions: Actions = {
	import: async (event) => {
		const { url } = packSource(event.params.id, event.url);
		const data = await event.request.formData();
		const mode = String(data.get('mode')) as PackSourceMode;
		if (!['lists', 'genre', 'none'].includes(mode)) return fail(400, { error: 'Choose a source' });
		const selected = new Set(data.getAll('items').map(Number));
		if (selected.size === 0) return fail(400, { error: 'Choose at least one collection' });

		const [addons, libraries] = await Promise.all([listAddons(env.DB), listLibraries(env.DB)]);
		const catalog =
			mode === 'genre'
				? (genreCatalogs(addons).find((item) => item.key === data.get('catalog')) ?? null)
				: null;
		if (mode === 'genre' && !catalog) return fail(400, { error: 'Choose a catalog' });
		if (mode === 'lists' && !(await traktClientId(env)))
			return fail(400, { error: 'Trakt lists need a Trakt API app. Add one under Scrobbling.' });

		let items;
		try {
			items = await loadPack(adminScope(event), url);
		} catch (cause) {
			if (cause instanceof PackError) return fail(502, { error: cause.message });
			throw cause;
		}
		const plan = planImport(
			items.filter((_, index) => selected.has(index)),
			{ mode, catalog, libraries }
		);
		await createCollections(env.DB, plan.create);
		await setLibraryImages(env.DB, plan.restyle);
		return { created: plan.create.length, restyled: plan.restyle.length, skipped: plan.skipped };
	}
};
