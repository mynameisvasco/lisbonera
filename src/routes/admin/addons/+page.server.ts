import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addonSchema } from '#lib/schemas.js';
import { AddonError, addAddon, refreshAddon } from '#lib/server/admin/addons.js';
import { field, orderedIds } from '#lib/server/admin/forms.js';
import { adminScope } from '#lib/server/admin/scope.js';
import { deleteAddon, listAddons, reorder, setAddonEnabled } from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const addons = await listAddons(env.DB);
	return {
		form: await superValidate(zod4(addonSchema)),
		addons: addons.map((addon) => ({
			id: addon.id,
			url: addon.url,
			host: new URL(addon.url).host,
			name: addon.manifest?.name ?? new URL(addon.url).host,
			version: addon.manifest?.version ?? null,
			description: addon.manifest?.description ?? null,
			logo: addon.manifest?.logo ?? null,
			catalogs: addon.manifest?.catalogs.length ?? 0,
			resources: (addon.manifest?.resources ?? []).map((resource) =>
				typeof resource === 'string' ? resource : resource.name
			),
			enabled: addon.enabled,
			lastError: addon.lastError,
			checkedAt: addon.checkedAt
		}))
	};
};

export const actions: Actions = {
	add: async (event) => {
		const form = await superValidate(event, zod4(addonSchema));
		if (!form.valid) return fail(400, { form });
		try {
			const manifest = await addAddon(adminScope(event), form.data.url);
			return message(form, `Added ${manifest.name}`);
		} catch (error) {
			if (error instanceof AddonError) return message(form, error.message, { status: 400 });
			throw error;
		}
	},
	toggle: async ({ request }) => {
		const data = await request.formData();
		await setAddonEnabled(env.DB, field(data, 'id'), field(data, 'enabled') === 'true');
	},
	reorder: async ({ request }) => {
		const known = (await listAddons(env.DB)).map((addon) => addon.id);
		await reorder(env.DB, 'addons', orderedIds(await request.formData(), known));
	},
	refresh: async (event) => {
		const data = await event.request.formData();
		try {
			await refreshAddon(adminScope(event), field(data, 'id'));
		} catch (error) {
			if (error instanceof AddonError) return fail(400, { error: error.message });
			throw error;
		}
	},
	remove: async ({ request }) => {
		const data = await request.formData();
		await deleteAddon(env.DB, field(data, 'id'));
	}
};
