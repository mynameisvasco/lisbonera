import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, guid } from '../src/lib/server/crypto';
import { runtimeTicks } from '../src/lib/server/jellyfin/dto';
import { paginate, videosToSeasons } from '../src/lib/server/jellyfin/media';
import { isPlayable } from '../src/lib/server/jellyfin/streams';
import { toMediaRef } from '../src/lib/server/scrobble/service';
import { normalizeAddonUrl } from '../src/lib/server/stremio/client';
import { show } from './helpers';

function pages(items: number[], size: number) {
	const calls: number[] = [];
	const fetchPage = async (skip: number) => {
		calls.push(skip);
		return items.slice(skip, skip + size);
	};
	return { calls, fetchPage };
}

const key = (value: number) => String(value);

describe('paginate', () => {
	it('fetches only up to the window plus one and reports a lower-bound total', async () => {
		const { calls, fetchPage } = pages([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
		const page = await paginate(fetchPage, 0, 2, { cap: 500, key });
		expect(page.items).toEqual([1, 2]);
		expect(page.total).toBeGreaterThan(2);
		expect(calls).toEqual([0]);
	});

	it('stops on short page and reports the exact total', async () => {
		const { calls, fetchPage } = pages([1, 2, 3, 4, 5], 3);
		const page = await paginate(fetchPage, 3, 10, { cap: 500, key });
		expect(page.items).toEqual([4, 5]);
		expect(page.total).toBe(5);
		expect(calls).toEqual([0, 3]);
	});

	it('handles an empty catalog', async () => {
		const page = await paginate(async () => [], 0, 10, { cap: 500, key });
		expect(page).toMatchObject({ items: [], total: 0, complete: true });
	});

	it('stops when an addon ignores skip and repeats the first page', async () => {
		let calls = 0;
		const page = await paginate(
			async () => {
				calls++;
				return [1, 2, 3];
			},
			0,
			10,
			{ cap: 500, key }
		);
		expect(page.items).toEqual([1, 2, 3]);
		expect(page.total).toBe(3);
		expect(calls).toBe(2);
	});

	it('caps the library size', async () => {
		const { fetchPage } = pages(
			Array.from({ length: 50 }, (_, i) => i),
			10
		);
		const page = await paginate(fetchPage, 0, 0, { cap: 25, key, all: true });
		expect(page.items).toHaveLength(25);
		expect(page.total).toBe(25);
	});
});

describe('videosToSeasons', () => {
	it('videosToSeasons skips unnumbered, orders episodes and puts specials last', () => {
		const seasons = videosToSeasons(show.videos);
		expect(seasons.map((season) => season.season)).toEqual([1, 2, 0]);
		expect(seasons[0].videos.map((video) => video.episode)).toEqual([1, 2]);
		expect(seasons[1].videos[0].episode).toBe(1);
		expect(
			seasons.flatMap((season) => season.videos).some((video) => video.id.endsWith('extra'))
		).toBe(false);
	});
});

describe('helpers', () => {
	it('guids are stable 32-char hex', async () => {
		const id = await guid('movie|tt1||');
		expect(id).toMatch(/^[0-9a-f]{32}$/);
		expect(await guid('movie|tt1||')).toBe(id);
	});

	it('encrypts and decrypts', async () => {
		const sealed = await encrypt('key', 'secret');
		expect(sealed).not.toContain('secret');
		expect(await decrypt('key', sealed)).toBe('secret');
		await expect(decrypt('other', sealed)).rejects.toThrow();
	});

	it('parses Stremio runtimes', () => {
		expect(runtimeTicks('142 min')).toBe(142 * 60 * 10_000_000);
		expect(runtimeTicks('2h 22min')).toBe(142 * 60 * 10_000_000);
		expect(runtimeTicks('45')).toBe(45 * 60 * 10_000_000);
		expect(runtimeTicks('N/A')).toBeNull();
	});

	it('normalizes addon URLs', () => {
		expect(normalizeAddonUrl('stremio://addon.test/abc/manifest.json')).toBe(
			'https://addon.test/abc'
		);
		expect(normalizeAddonUrl('https://addon.test/')).toBe('https://addon.test');
		expect(() => normalizeAddonUrl('ftp://addon.test')).toThrow();
	});

	it('only plain http streams are playable', () => {
		expect(isPlayable({ url: 'https://x.test/a.mkv' })).toBe(true);
		expect(isPlayable({ infoHash: 'abc' })).toBe(false);
		expect(isPlayable({ url: 'magnet:?xt=abc' })).toBe(false);
		expect(isPlayable({ url: 'https://x.test/a', behaviorHints: { proxyHeaders: {} } })).toBe(
			false
		);
	});
});

describe('toMediaRef', () => {
	const base = { season: null, episode: null };

	it('maps IMDb and TMDB ids', () => {
		expect(toMediaRef({ ...base, kind: 'movie', stremioId: 'tt1' })).toEqual({
			type: 'movie',
			imdb: 'tt1'
		});
		expect(toMediaRef({ kind: 'episode', stremioId: 'tmdb:5', season: 1, episode: 2 })).toEqual({
			type: 'episode',
			tmdb: '5',
			season: 1,
			episode: 2
		});
	});

	it('toMediaRef returns null for kitsu', () => {
		expect(toMediaRef({ ...base, kind: 'movie', stremioId: 'kitsu:100' })).toBeNull();
	});
});

describe('IdMap', () => {
	it('writes and resolves more rows than fit in one statement', async () => {
		const { env } = await import('cloudflare:workers');
		const { IdMap } = await import('../src/lib/server/ids');
		const writer = new IdMap(env.DB);
		const entries = [];
		for (let episode = 1; episode <= 25; episode++) {
			entries.push(
				await writer.register({
					kind: 'episode',
					stremioId: 'tt9',
					season: 1,
					episode,
					name: `E${episode}`
				})
			);
		}
		await writer.flush();
		const { memo } = await import('../src/lib/server/scope');
		memo.clear();
		const reader = new IdMap(env.DB);
		await reader.preload(entries.map((entry) => entry.guid));
		for (const entry of entries) expect((await reader.resolve(entry.guid))?.name).toBe(entry.name);
	});

	it('does not cache bare registrations', async () => {
		const { env } = await import('cloudflare:workers');
		const { IdMap } = await import('../src/lib/server/ids');
		const ids = new IdMap(env.DB);
		await ids.register({
			kind: 'series',
			stremioId: 'tt8',
			name: 'Show',
			poster: 'https://img.test/p.jpg'
		});
		await ids.flush();
		const { memo } = await import('../src/lib/server/scope');
		memo.clear();
		const bare = await new IdMap(env.DB).register({ kind: 'series', stremioId: 'tt8' });
		expect((await new IdMap(env.DB).resolve(bare.guid))?.poster).toBe('https://img.test/p.jpg');
	});
});
