import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { getLibrary, loadImage, UPLOAD_PREFIX } from '#lib/server/store.js';
import type { RequestHandler } from './$types';

/** Uploaded library artwork for the dashboard; the `v` query changes with the artwork, so it can be cached for good. */
export const GET: RequestHandler = async ({ params }) => {
	const library = await getLibrary(env.DB, params.id);
	if (!library?.image?.startsWith(UPLOAD_PREFIX)) error(404, 'No uploaded artwork');
	const stored = await loadImage(env.DB, library.image);
	if (!stored) error(404, 'No artwork');
	return new Response(stored.data, {
		headers: {
			'content-type': stored.contentType,
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};
