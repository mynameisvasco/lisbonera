import { env } from 'cloudflare:workers';
import { error, fail } from '@sveltejs/kit';
import { field, orderedIds } from '#lib/server/admin/forms.js';
import { adminScope } from '#lib/server/admin/scope.js';
import { search, type MediaType } from '#lib/server/jellyfin/media.js';
import {
	addCollectionItem,
	getLibrary,
	listCollectionItems,
	removeCollectionItem,
	reorderCollection
} from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

async function collection(db: D1Database, id: string) {
	const library = await getLibrary(db, id);
	if (!library || library.kind !== 'collection') error(404, 'Collection not found');
	return library;
}

function allowedTypes(type: string): MediaType[] {
	return type === 'movie' ? ['movie'] : type === 'series' ? ['series'] : ['movie', 'series'];
}

export const load: PageServerLoad = async (event) => {
	const db = env.DB;
	const library = await collection(db, event.params.id);
	const items = await listCollectionItems(db, library.id);
	const query = event.url.searchParams.get('q')?.trim() ?? '';
	const inCollection = new Set(items.map((item) => item.stremioId));
	const results = query
		? (await search(adminScope(event), query, allowedTypes(library.catalogType), 30)).map(
				({ meta, type }) => ({
					id: meta.id,
					type,
					name: meta.name,
					poster: meta.poster ?? null,
					year: String(meta.releaseInfo ?? meta.year ?? '').slice(0, 4),
					added: inCollection.has(meta.id)
				})
			)
		: [];
	return {
		library: { id: library.id, name: library.name, type: library.catalogType },
		items,
		query,
		results
	};
};

export const actions: Actions = {
	add: async ({ request, params }) => {
		const db = env.DB;
		const library = await collection(db, params.id);
		const data = await request.formData();
		const type = field(data, 'type');
		if (type !== 'movie' && type !== 'series') return fail(400, { error: 'Unsupported type' });
		if (!allowedTypes(library.catalogType).includes(type))
			return fail(400, { error: 'This collection does not accept that type' });
		const poster = data.get('poster');
		await addCollectionItem(db, {
			libraryId: library.id,
			stremioType: type,
			stremioId: field(data, 'stremioId'),
			name: field(data, 'name'),
			poster: typeof poster === 'string' && poster ? poster : null
		});
	},
	remove: async ({ request, params }) => {
		const db = env.DB;
		const library = await collection(db, params.id);
		await removeCollectionItem(db, library.id, field(await request.formData(), 'stremioId'));
	},
	reorder: async ({ request, params }) => {
		const library = await collection(env.DB, params.id);
		const known = (await listCollectionItems(env.DB, library.id)).map((item) => item.stremioId);
		await reorderCollection(env.DB, library.id, orderedIds(await request.formData(), known));
	}
};
