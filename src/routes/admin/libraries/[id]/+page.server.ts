import { env } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { renameSchema } from '#lib/schemas.js';
import { field, orderedIds } from '#lib/server/admin/forms.js';
import { describeLibrary } from '#lib/server/admin/libraries.js';
import { libraryPreviews } from '#lib/server/admin/previews.js';
import { adminScope } from '#lib/server/admin/scope.js';
import { search, type MediaType } from '#lib/server/jellyfin/media.js';
import {
	addCollectionItem,
	deleteLibrary,
	getLibrary,
	listAddons,
	listCollectionItems,
	MAX_IMAGE_BYTES,
	removeCollectionItem,
	reorderCollection,
	saveImage,
	updateLibrary,
	type Library
} from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function library(db: D1Database, id: string) {
	const found = await getLibrary(db, id);
	if (!found) error(404, 'Library not found');
	return found;
}

/** Hand-picked collections are the only libraries whose titles are edited here. */
async function manual(db: D1Database, id: string) {
	const found = await library(db, id);
	if (found.kind !== 'collection' || found.sources.length > 0)
		error(400, 'This library follows its source');
	return found;
}

function allowedTypes(type: Library['catalogType']): MediaType[] {
	return type === 'movie' ? ['movie'] : type === 'series' ? ['series'] : ['movie', 'series'];
}

function aspect(value: FormDataEntryValue | null): number | null {
	const number = Number(value);
	return Number.isFinite(number) && number > 0.2 && number < 5
		? Math.round(number * 1000) / 1000
		: null;
}

export const load: PageServerLoad = async (event) => {
	const db = env.DB;
	const found = await library(db, event.params.id);
	const isManual = found.kind === 'collection' && found.sources.length === 0;
	const [items, addons] = await Promise.all([
		isManual ? listCollectionItems(db, found.id) : Promise.resolve([]),
		listAddons(db)
	]);
	const query = isManual ? (event.url.searchParams.get('q')?.trim() ?? '') : '';
	const inCollection = new Set(items.map((item) => item.stremioId));
	const scope = adminScope(event);
	const [results, previews] = await Promise.all([
		query
			? search(scope, query, allowedTypes(found.catalogType), 24).then((found) =>
					found.map(({ meta, type }) => ({
						id: meta.id,
						type,
						name: meta.name,
						poster: meta.poster ?? null,
						year: String(meta.releaseInfo ?? meta.year ?? '').slice(0, 4),
						added: inCollection.has(meta.id)
					}))
				)
			: Promise.resolve([]),
		isManual ? Promise.resolve(null) : libraryPreviews(scope, [found], 24)
	]);
	return {
		library: describeLibrary(found, addons),
		renameForm: await superValidate({ id: found.id, name: found.name }, zod4(renameSchema), {
			id: 'rename',
			errors: false
		}),
		items,
		preview: previews?.[found.id] ?? [],
		query,
		results
	};
};

export const actions: Actions = {
	rename: async ({ request, params }) => {
		const form = await superValidate(request, zod4(renameSchema), { id: 'rename' });
		if (!form.valid) return fail(400, { renameForm: form });
		await updateLibrary(env.DB, (await library(env.DB, params.id)).id, { name: form.data.name });
		return message(form, 'Renamed');
	},
	toggle: async ({ request, params }) => {
		const found = await library(env.DB, params.id);
		await updateLibrary(env.DB, found.id, {
			enabled: field(await request.formData(), 'enabled') === 'true'
		});
	},
	artwork: async ({ request, params }) => {
		const found = await library(env.DB, params.id);
		const data = await request.formData();
		const file = data.get('file');
		if (file instanceof File && file.size > 0) {
			if (!IMAGE_TYPES.has(file.type)) return fail(400, { error: 'Use a JPEG, PNG or WebP image' });
			if (file.size > MAX_IMAGE_BYTES) return fail(400, { error: 'The image is larger than 1 MB' });
			const ref = await saveImage(env.DB, file.type, await file.arrayBuffer());
			await updateLibrary(env.DB, found.id, {
				image: { url: ref, aspect: aspect(data.get('aspect')) }
			});
			return { saved: true };
		}
		const url = String(data.get('url') ?? '').trim();
		if (!/^https?:\/\/\S+$/i.test(url)) return fail(400, { error: 'Enter an http(s) image URL' });
		await updateLibrary(env.DB, found.id, { image: { url, aspect: aspect(data.get('aspect')) } });
		return { saved: true };
	},
	clearArtwork: async ({ params }) => {
		const found = await library(env.DB, params.id);
		await updateLibrary(env.DB, found.id, { image: { url: null, aspect: null } });
	},
	add: async ({ request, params }) => {
		const db = env.DB;
		const found = await manual(db, params.id);
		const data = await request.formData();
		const type = field(data, 'type');
		if (type !== 'movie' && type !== 'series') return fail(400, { error: 'Unsupported type' });
		if (!allowedTypes(found.catalogType).includes(type))
			return fail(400, { error: 'This collection does not accept that type' });
		const poster = data.get('poster');
		await addCollectionItem(db, {
			libraryId: found.id,
			stremioType: type,
			stremioId: field(data, 'stremioId'),
			name: field(data, 'name'),
			poster: typeof poster === 'string' && poster ? poster : null
		});
	},
	remove: async ({ request, params }) => {
		const found = await manual(env.DB, params.id);
		await removeCollectionItem(env.DB, found.id, field(await request.formData(), 'stremioId'));
	},
	reorder: async ({ request, params }) => {
		const found = await manual(env.DB, params.id);
		const known = (await listCollectionItems(env.DB, found.id)).map((item) => item.stremioId);
		await reorderCollection(env.DB, found.id, orderedIds(await request.formData(), known));
	},
	delete: async ({ params }) => {
		const found = await library(env.DB, params.id);
		if (found.kind !== 'collection')
			return fail(400, { error: 'Catalog libraries can only be hidden' });
		await deleteLibrary(env.DB, found.id);
		redirect(303, '/admin/libraries');
	}
};
