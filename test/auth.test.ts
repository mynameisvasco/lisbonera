import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { verifyAccess } from '../src/lib/server/auth/access';
import {
	createAppPassword,
	extractToken,
	parseAuthorization,
	revokeAppPassword
} from '../src/lib/server/auth/client';
import { Query } from '../src/lib/server/http';
import { authed, call, seed } from './helpers';

beforeEach(seed);

function request(headers: Record<string, string> = {}, search = '') {
	return {
		request: new Request(`https://media.test/Items${search}`, { headers }),
		query: new Query(new URLSearchParams(search))
	};
}

describe('extractToken variants', () => {
	it.each([
		[{ authorization: 'MediaBrowser Client="Infuse", Token="abc"' }, ''],
		[{ authorization: 'Emby UserId="u", Token=abc' }, ''],
		[{ authorization: 'mediabrowser token="abc", client="x"' }, ''],
		[{ 'x-emby-authorization': 'MediaBrowser Token="abc"' }, ''],
		[{ 'x-emby-token': 'abc' }, ''],
		[{}, '?api_key=abc'],
		[{}, '?ApiKey=abc']
	])('finds the token in %o %s', (headers, search) => {
		const { request: req, query } = request(headers, search);
		expect(extractToken(req, query)).toBe('abc');
	});

	it('decodes percent-encoded values', () => {
		expect(parseAuthorization('MediaBrowser Device="Apple%20TV", Token="t"').device).toBe(
			'Apple TV'
		);
	});
});

describe('login', () => {
	async function authenticate(password: string, username = 'admin') {
		return call('/Users/AuthenticateByName', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ Username: username, Pw: password })
		});
	}

	it('accepts the app password with or without dashes and in any case', async () => {
		const { password } = await createAppPassword(env.DB, 'TV');
		expect(password).toMatch(/^([a-z2-9]{4}-){5}[a-z2-9]{4}$/);
		expect((await authenticate(password)).status).toBe(200);
		expect((await authenticate(password.replace(/-/g, '').toUpperCase(), 'ADMIN')).status).toBe(
			200
		);
	});

	it('rejects a wrong password or user', async () => {
		const { password } = await createAppPassword(env.DB, 'TV');
		expect((await authenticate('wrong')).status).toBe(401);
		expect((await authenticate(password, 'someone')).status).toBe(401);
	});

	it('revoking an app password ends its sessions', async () => {
		const { id, password } = await createAppPassword(env.DB, 'TV');
		const body = (await (await authenticate(password)).json()) as {
			AccessToken: string;
			User: { Id: string };
		};
		expect(body.User.Id).toMatch(/^[0-9a-f]{32}$/);
		expect((await call('/Users/Me', authed(body.AccessToken))).status).toBe(200);
		await revokeAppPassword(env.DB, id);
		expect((await call('/Users/Me', authed(body.AccessToken))).status).toBe(401);
	});
});

describe('Cloudflare Access', () => {
	it('rejects requests without a valid assertion', async () => {
		expect(await verifyAccess(new Request('https://media.test/admin'), env)).toBeNull();
		const forged = new Request('https://media.test/admin', {
			headers: { 'cf-access-jwt-assertion': 'a.b.c' }
		});
		expect(await verifyAccess(forged, env)).toBeNull();
	});
});
