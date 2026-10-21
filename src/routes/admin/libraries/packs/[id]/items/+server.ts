import { error, json } from '@sveltejs/kit';
import { packs } from '#lib/packs.js';
import { loadPack, PackError } from '#lib/server/admin/packs.js';
import { adminScope } from '#lib/server/admin/scope.js';
import type { RequestHandler } from './$types';

/** A pack's artwork, for picking one image for a single library. */
export const GET: RequestHandler = async (event) => {
	const listing = packs.find((pack) => pack.id === event.params.id);
	if (!listing) error(404, 'Pack not found');
	try {
		const items = await loadPack(adminScope(event), (listing.url ?? listing.sourcedUrl)!);
		return json(items.map(({ name, image, shape }) => ({ name, image, shape })));
	} catch (cause) {
		if (cause instanceof PackError) error(502, cause.message);
		throw cause;
	}
};
