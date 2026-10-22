import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	collectionSchema,
	genreCollectionsSchema,
	mdblistKeySchema,
	listSchema
} from '#lib/schemas.js';
import { genreCatalogs } from '#lib/server/admin/collections.js';
import { field, orderedIds } from '#lib/server/admin/forms.js';
import { describeLibrary } from '#lib/server/admin/libraries.js';
import { libraryPreviews } from '#lib/server/admin/previews.js';
import { adminScope } from '#lib/server/admin/scope.js';
import {
	fetchListInfo,
	loadMdblistKey,
	MdblistError,
	parseListRef,
	saveMdblistKey
} from '#lib/server/mdblist.js';
import {
	fetchTraktListInfo,
	parseTraktList,
	traktClientId,
	TraktListError
} from '#lib/server/trakt-lists.js';
import {
	createCollection,
	createCollections,
	deleteLibrary,
	getLibrary,
	listAddons,
	listLibraries,
	reorder,
	updateLibrary
} from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// The layout loads seeded addon manifests; wait for it so their libraries exist on the first visit.
	await event.parent();
	const [libraries, addons, mdblistKey, traktApp] = await Promise.all([
		listLibraries(env.DB),
		listAddons(env.DB),
		loadMdblistKey(env),
		traktClientId(env)
	]);
	const previews = await libraryPreviews(adminScope(event), libraries, 5);
	return {
		createForm: await superValidate(zod4(collectionSchema), { id: 'create' }),
		genresForm: await superValidate(zod4(genreCollectionsSchema), { id: 'genres', errors: false }),
		listForm: await superValidate(zod4(listSchema), { id: 'list' }),
		keyForm: await superValidate(zod4(mdblistKeySchema), { id: 'key' }),
		hasMdblistKey: mdblistKey !== null,
		hasTraktApp: traktApp !== null,
		genreCatalogs: genreCatalogs(addons),
		libraries: libraries.map((library) => ({
			...describeLibrary(library, addons),
			posters: previews[library.id] ?? []
		}))
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod4(collectionSchema), { id: 'create' });
		if (!form.valid) return fail(400, { createForm: form });
		const id = await createCollection(env.DB, form.data.name, form.data.type);
		redirect(303, `/admin/libraries/${id}`);
	},
	genres: async ({ request }) => {
		const form = await superValidate(request, zod4(genreCollectionsSchema), { id: 'genres' });
		if (!form.valid) return fail(400, { genresForm: form });
		const catalog = genreCatalogs(await listAddons(env.DB)).find(
			(item) => item.key === form.data.catalog
		);
		if (!catalog) return setError(form, 'catalog', 'That catalog is no longer available');
		const genres = catalog.genres.filter((genre) => form.data.genres.includes(genre));
		if (genres.length === 0) return setError(form, 'Choose at least one genre');
		await createCollections(
			env.DB,
			genres.map((genre) => ({
				name: genre,
				type: catalog.type,
				sources: [
					{
						kind: 'catalog',
						addonId: catalog.addonId,
						type: catalog.type,
						catalogId: catalog.catalogId,
						genre
					}
				]
			}))
		);
		return message(
			form,
			`Created ${genres.length} ${genres.length === 1 ? 'collection' : 'collections'}`
		);
	},
	list: async (event) => {
		const form = await superValidate(event.request, zod4(listSchema), { id: 'list' });
		if (!form.valid) return fail(400, { listForm: form });
		const scope = adminScope(event);
		const trakt = /trakt\.tv/i.test(form.data.list) ? parseTraktList(form.data.list) : null;
		let id: string;
		try {
			if (trakt) {
				const clientId = await traktClientId(env);
				if (!clientId)
					return setError(
						form,
						'list',
						'Trakt lists need a Trakt API app. Add one under Scrobbling.'
					);
				const info = await fetchTraktListInfo(scope, clientId, trakt);
				id = await createCollection(env.DB, form.data.name || info.name, 'mixed', [
					{ kind: 'trakt', ...trakt, name: info.name }
				]);
			} else {
				const ref = parseListRef(form.data.list);
				if (!ref) return setError(form, 'list', 'Paste a mdblist.com or trakt.tv list URL');
				const key = await loadMdblistKey(env);
				if (!key) return setError(form, 'list', 'Save your MDBList API key first');
				const info = await fetchListInfo(scope, key, ref);
				id = await createCollection(env.DB, form.data.name || info.name, info.type, [
					{ kind: 'mdblist', list: ref }
				]);
			}
		} catch (error) {
			if (error instanceof MdblistError || error instanceof TraktListError)
				return setError(form, 'list', error.message);
			throw error;
		}
		redirect(303, `/admin/libraries/${id}`);
	},
	key: async ({ request }) => {
		const form = await superValidate(request, zod4(mdblistKeySchema), { id: 'key' });
		if (!form.valid) return fail(400, { keyForm: form });
		await saveMdblistKey(env, form.data.key);
		return message(form, 'MDBList key saved');
	},
	forgetKey: async () => {
		await saveMdblistKey(env, null);
	},
	toggle: async ({ request }) => {
		const data = await request.formData();
		await updateLibrary(env.DB, field(data, 'id'), { enabled: field(data, 'enabled') === 'true' });
	},
	reorder: async ({ request }) => {
		const known = (await listLibraries(env.DB)).map((library) => library.id);
		await reorder(env.DB, 'libraries', orderedIds(await request.formData(), known));
	},
	remove: async ({ request }) => {
		const library = await getLibrary(env.DB, field(await request.formData(), 'id'));
		if (library?.kind !== 'collection')
			return fail(400, { error: 'Catalog libraries can only be hidden' });
		await deleteLibrary(env.DB, library.id);
	}
};
