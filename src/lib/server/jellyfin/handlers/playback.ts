import type { PlaybackInfoResponse } from '@jellyfin/sdk/lib/generated-client/models';
import { randomHex } from '../../crypto';
import { json, notFound, redirect } from '../../http';
import type { JfContext } from '../context';
import { mediaSource } from '../dto';
import { itemDto } from '../media';
import type { Router } from '../router';
import { resolveSources, sourceUrl } from '../streams';

async function playbackInfo(c: JfContext): Promise<Response> {
	const entry = await c.ids.resolve(c.params.itemId.replace(/-/g, ''));
	if (!entry || (entry.kind !== 'movie' && entry.kind !== 'episode')) return notFound();

	const [sources, item] = await Promise.all([resolveSources(c, entry), itemDto(c, entry)]);
	const path = item?.Path ?? entry.name ?? entry.stremioId;
	const runtime = item?.RunTimeTicks ?? entry.runtimeTicks;
	const response: PlaybackInfoResponse = {
		MediaSources: sources.map((source) => mediaSource(source, path, runtime)),
		PlaySessionId: randomHex(16),
		...(sources.length === 0 ? { ErrorCode: 'NoCompatibleStream' } : {})
	};
	return json(response);
}

/** Video bytes never pass through the Worker: the client is redirected to the addon's URL. */
async function stream(c: JfContext): Promise<Response> {
	const entry = await c.ids.resolve(c.params.itemId.replace(/-/g, ''));
	if (!entry || (entry.kind !== 'movie' && entry.kind !== 'episode')) return notFound();
	const url = await sourceUrl(c, entry, c.query.get('MediaSourceId') ?? c.params.mediaSourceId);
	return url ? redirect(url) : notFound();
}

export function playbackRoutes(router: Router): void {
	router.on(['GET', 'POST'], '/items/:itemId/playbackinfo', playbackInfo);
	router.on(
		'GET',
		[
			'/videos/:itemId/stream',
			'/videos/:itemId/stream.:container',
			'/videos/:itemId/:mediaSourceId/stream',
			'/videos/:itemId/:mediaSourceId/stream.:container',
			'/items/:itemId/download',
			'/items/:itemId/file'
		],
		stream
	);
}
