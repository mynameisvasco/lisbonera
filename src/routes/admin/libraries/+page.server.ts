import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { collectionSchema, renameSchema } from '#lib/schemas.js';
import { field, orderedIds } from '#lib/server/admin/forms.js';
import { libraryPreviews } from '#lib/server/admin/previews.js';
import { adminScope } from '#lib/server/admin/scope.js';
import {
	createCollection,
	deleteLibrary,
	getLibrary,
	listAddons,
	listLibraries,
	reorder,
	updateLibrary
} from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [libraries, addons] = await Promise.all([listLibraries(env.DB), listAddons(env.DB)]);
	const previews = await libraryPreviews(adminScope(event), libraries, 3);
	const addonNames = new Map(
		addons.map((addon) => [addon.id, addon.manifest?.name ?? new URL(addon.url).host])
	);
	return {
		createForm: await superValidate(zod4(collectionSchema), { id: 'create' }),
		renameForm: await superValidate(zod4(renameSchema), { id: 'rename' }),
		libraries: libraries.map((library) => ({
			id: library.id,
			name: library.name,
			kind: library.kind,
			type: library.catalogType,
			source:
				library.kind === 'collection'
					? 'Collection'
					: (addonNames.get(library.addonId ?? '') ?? 'Unknown'),
			enabled: library.enabled,
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
	rename: async ({ request }) => {
		const form = await superValidate(request, zod4(renameSchema), { id: 'rename' });
		if (!form.valid) return fail(400, { renameForm: form });
		await updateLibrary(env.DB, form.data.id, { name: form.data.name });
		return message(form, 'Renamed');
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
