import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { collectionSchema, renameSchema } from '#lib/schemas.js';
import { field, moved } from '#lib/server/admin/forms.js';
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

export const load: PageServerLoad = async () => {
	const db = env.DB;
	const [libraries, addons] = await Promise.all([listLibraries(db), listAddons(db)]);
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
			enabled: library.enabled
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
		await updateLibrary(env.DB, field(data, 'id'), {
			enabled: field(data, 'enabled') === 'true'
		});
	},
	move: async ({ request }) => {
		const data = await request.formData();
		const db = env.DB;
		const ids = (await listLibraries(db)).map((library) => library.id);
		await reorder(db, 'libraries', moved(ids, field(data, 'id'), field(data, 'direction')));
	},
	remove: async ({ request }) => {
		const data = await request.formData();
		const db = env.DB;
		const library = await getLibrary(db, field(data, 'id'));
		if (library?.kind !== 'collection')
			return fail(400, { error: 'Catalog libraries can only be disabled' });
		await deleteLibrary(db, library.id);
	}
};
