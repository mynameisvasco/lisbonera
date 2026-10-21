import type { UserItemDataDto } from '@jellyfin/sdk/lib/generated-client/models';
import { json, noContent, notFound, readJson } from '../../http';
import type { IdEntry } from '../../ids';
import { memo } from '../../scope';
import { invalidateReads, runScrobble, toMediaRef } from '../../scrobble/service';
import type { ScrobbleEvent } from '../../scrobble/types';
import type { JfContext } from '../context';
import { runtimeTicks } from '../dto';
import { loadMeta } from '../media';
import type { Router } from '../router';

/** Clients report progress every few seconds; providers only need a refresh every few minutes. */
const PROGRESS_INTERVAL = 5 * 60 * 1000;

interface PlaybackReport {
	ItemId: string;
	PositionTicks: number;
	IsPaused: boolean;
}

async function runtimeOf(c: JfContext, entry: IdEntry): Promise<number | null> {
	if (entry.runtimeTicks) return entry.runtimeTicks;
	const meta = await loadMeta(c, entry.kind === 'movie' ? 'movie' : 'series', entry.stremioId);
	const ticks = runtimeTicks(meta?.runtime);
	if (ticks) await c.ids.register({ ...entry, runtimeTicks: ticks });
	return ticks;
}

function report(kind: 'start' | 'progress' | 'stop') {
	return async (c: JfContext): Promise<Response> => {
		const body = await readJson<PlaybackReport>(c.request);
		const itemId = String(body.ItemId ?? c.query.get('ItemId') ?? '')
			.toLowerCase()
			.replace(/-/g, '');
		const entry = itemId ? await c.ids.resolve(itemId) : null;
		const ref = entry ? toMediaRef(entry) : null;
		if (!entry || !ref || ref.type === 'show') return noContent();

		const event: ScrobbleEvent = kind === 'stop' ? 'stop' : body.IsPaused ? 'pause' : 'start';
		const throttleKey = `scrobble-report:${entry.guid}`;
		const last = memo.get<ScrobbleEvent>(throttleKey, PROGRESS_INTERVAL);
		if (kind === 'progress' && last?.fresh && last.value === event) return noContent();
		memo.set(throttleKey, event);

		c.exec.waitUntil(
			(async () => {
				const runtime = await runtimeOf(c, entry);
				const position = Number(body.PositionTicks ?? 0);
				const progress = runtime && position > 0 ? (position / runtime) * 100 : 0;
				await runScrobble(c, (provider) => provider.scrobble(event, ref, progress));
				if (event === 'stop') invalidateReads(ref);
				await c.ids.flush();
			})()
		);
		return noContent();
	};
}

function playedState(itemId: string, played: boolean): UserItemDataDto {
	return {
		Key: itemId,
		ItemId: itemId,
		Played: played,
		PlayCount: played ? 1 : 0,
		PlaybackPositionTicks: 0,
		IsFavorite: false
	};
}

function markPlayed(played: boolean) {
	return async (c: JfContext): Promise<Response> => {
		const entry = await c.ids.resolve(c.params.itemId.toLowerCase().replace(/-/g, ''));
		if (!entry) return notFound();
		const ref = toMediaRef(entry);
		if (ref && ref.type !== 'show') {
			await runScrobble(c, (provider) => provider.setWatched(ref, played));
			invalidateReads(ref);
		}
		return json(playedState(entry.guid, played));
	};
}

export function sessionRoutes(router: Router): void {
	router.on(
		'POST',
		['/sessions/capabilities', '/sessions/capabilities/full', '/sessions/playing/ping'],
		() => noContent()
	);
	router.on('POST', '/sessions/playing', report('start'));
	router.on('POST', '/sessions/playing/progress', report('progress'));
	router.on('POST', '/sessions/playing/stopped', report('stop'));
	router.on(
		'POST',
		['/users/:userId/playeditems/:itemId', '/userplayeditems/:itemId'],
		markPlayed(true)
	);
	router.on(
		'DELETE',
		['/users/:userId/playeditems/:itemId', '/userplayeditems/:itemId'],
		markPlayed(false)
	);
	router.on(
		['POST', 'DELETE'],
		['/users/:userId/favoriteitems/:itemId', '/userfavoriteitems/:itemId'],
		(c) => json(playedState(c.params.itemId, false))
	);
}
