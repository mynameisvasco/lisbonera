import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';

const MAX_EDGE = 1600;
const QUALITY = 0.86;

/**
 * Scales an image down to at most 1600px on its longest edge and re-encodes it as JPEG, which every Jellyfin app
 * can show and keeps uploads well under D1's row limit.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; aspect: number }> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is not available');
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', QUALITY));
	if (!blob) throw new Error('Could not encode the image');
	return { blob, aspect: width / height };
}

/** Measures a remote image so its tile keeps the right shape in apps; null when it cannot load. */
export function measureImage(url: string): Promise<number | null> {
	return new Promise((done) => {
		const image = new Image();
		image.onload = () =>
			done(image.naturalHeight ? image.naturalWidth / image.naturalHeight : null);
		image.onerror = () => done(null);
		image.src = url;
	});
}

/** Posts to the library page's `artwork` action outside a `<form>`, then reloads the page data. */
export async function saveArtwork(fields: {
	file?: Blob;
	url?: string;
	aspect: number | null;
}): Promise<string | null> {
	const body = new FormData();
	if (fields.file) body.set('file', fields.file, 'artwork.jpg');
	if (fields.url) body.set('url', fields.url);
	if (fields.aspect) body.set('aspect', String(fields.aspect));
	const response = await fetch('?/artwork', {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await response.text());
	if (result.type === 'failure')
		return typeof result.data?.error === 'string'
			? result.data.error
			: 'Could not save the artwork';
	if (result.type === 'error') return 'Could not save the artwork';
	await invalidateAll();
	return null;
}
