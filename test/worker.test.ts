import { beforeEach, describe, expect, it } from 'vitest';
import { isJellyfinPath, normalizePath } from '../src/lib/server/jellyfin/router';
import { authed, call, login, seed } from './helpers';

beforeEach(seed);

describe('routing', () => {
	it('sends the dashboard and assets to SvelteKit', async () => {
		expect(await (await call('/admin')).text()).toBe('sveltekit');
		expect(await (await call('/admin/addons')).text()).toBe('sveltekit');
		expect(await (await call('/')).text()).toBe('sveltekit');
		expect(isJellyfinPath('/_app/immutable/x.js')).toBe(false);
		expect(isJellyfinPath('/Items')).toBe(true);
		expect(isJellyfinPath('/administrator')).toBe(true);
	});

	it('normalizes case, the legacy prefixes and trailing slashes', () => {
		expect(normalizePath('/Emby/Users/ABC/Items/')).toBe('/users/abc/items');
		expect(normalizePath('/jellyfin/System/Info')).toBe('/system/info');
	});

	it.each(['/System/Info/Public', '/system/info/public', '/emby/System/Info/Public'])('serves %s', async (path) => {
		const response = await call(path);
		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		const body = (await response.json()) as { ProductName: string; Id: string; Version: string };
		expect(body.ProductName).toBe('Jellyfin Server');
		expect(body.Id).toMatch(/^[0-9a-f]{32}$/);
		expect(body.Version).toBe('10.11.0');
	});

	it('answers CORS preflight', async () => {
		const response = await call('/Items', { method: 'OPTIONS' });
		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-headers')).toContain('X-Emby-Authorization');
	});

	it('returns 404 for unknown endpoints', async () => {
		const token = await login();
		expect((await call('/Unknown/Thing', authed(token))).status).toBe(404);
	});
});

describe('native client requests', () => {
	it('accepts a POST without Origin or Content-Type (blocked by SvelteKit CSRF if routed there)', async () => {
		const token = await login();
		const response = await call('/Sessions/Playing/Stopped', authed(token, { method: 'POST' }));
		expect(response.status).toBe(204);
	});

	it('requires a token for private endpoints', async () => {
		expect((await call('/Users/Me')).status).toBe(401);
		expect((await call('/Sessions/Playing/Stopped', { method: 'POST' })).status).toBe(401);
	});
});
