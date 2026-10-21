import { generateAppPassword, randomHex, sha256Hex } from '../crypto';
import type { Query } from '../http';
import { memo } from '../scope';

const SESSION_MEMO_TTL = 60 * 1000;
const LAST_SEEN_INTERVAL = 3600 * 1000;

export interface ClientInfo {
	client: string;
	device: string;
	deviceId: string;
	version: string;
}

export interface Session extends ClientInfo {
	tokenHash: string;
	appPasswordId: string;
	lastSeenAt: number;
}

export interface AppPassword {
	id: string;
	label: string;
	createdAt: number;
	lastUsedAt: number | null;
}

interface SessionRow {
	token_hash: string;
	app_password_id: string;
	client: string;
	device: string;
	device_id: string;
	version: string;
	created_at: number;
	last_seen_at: number;
}

/** Parses `MediaBrowser Client="Infuse", Token="abc"` and the `Emby …` variant, quoted or not. */
/** Dashes and case are ignored so the password can be typed however is easiest on a TV keyboard. */
function hashAppPassword(password: string): Promise<string> {
	return sha256Hex(password.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function parseAuthorization(header: string | null): Record<string, string> {
	if (!header) return {};
	const params = header.replace(/^\s*(MediaBrowser|Emby)\s+/i, '');
	const out: Record<string, string> = {};
	for (const match of params.matchAll(/([A-Za-z]+)\s*=\s*(?:"([^"]*)"|([^,\s]*))/g)) {
		const value = match[2] ?? match[3] ?? '';
		try {
			out[match[1].toLowerCase()] = decodeURIComponent(value);
		} catch {
			out[match[1].toLowerCase()] = value;
		}
	}
	return out;
}

function authParams(request: Request): Record<string, string> {
	return parseAuthorization(
		request.headers.get('authorization') ?? request.headers.get('x-emby-authorization')
	);
}

export function extractToken(request: Request, query: Query): string | null {
	return (
		authParams(request).token ||
		request.headers.get('x-emby-token') ||
		request.headers.get('x-mediabrowser-token') ||
		query.get('api_key') ||
		query.get('ApiKey') ||
		null
	);
}

export function clientInfo(request: Request): ClientInfo {
	const params = authParams(request);
	return {
		client: params.client || 'Unknown',
		device: params.device || 'Unknown',
		deviceId: params.deviceid || 'unknown',
		version: params.version || '0'
	};
}

export async function authenticate(db: D1Database, token: string | null): Promise<Session | null> {
	if (!token) return null;
	const tokenHash = await sha256Hex(token);
	const cached = memo.get<Session | null>(`session:${tokenHash}`, SESSION_MEMO_TTL);
	if (cached?.fresh) return cached.value;

	const row = await db
		.prepare('SELECT * FROM sessions WHERE token_hash = ?')
		.bind(tokenHash)
		.first<SessionRow>();
	const session: Session | null = row
		? {
				tokenHash: row.token_hash,
				appPasswordId: row.app_password_id,
				client: row.client,
				device: row.device,
				deviceId: row.device_id,
				version: row.version,
				lastSeenAt: row.last_seen_at
			}
		: null;
	memo.set(`session:${tokenHash}`, session);
	return session;
}

/** `last_seen_at` is only written hourly to stay well inside the D1 free write quota. */
export async function touchSession(db: D1Database, session: Session): Promise<void> {
	const now = Date.now();
	if (now - session.lastSeenAt < LAST_SEEN_INTERVAL) return;
	session.lastSeenAt = now;
	await db
		.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
		.bind(now, session.tokenHash)
		.run();
}

export async function login(
	db: D1Database,
	expectedUsername: string,
	username: string,
	password: string,
	info: ClientInfo
): Promise<string | null> {
	if (username.trim().toLowerCase() !== expectedUsername.toLowerCase() || !password) return null;
	const appPassword = await db
		.prepare('SELECT id FROM app_passwords WHERE hash = ?')
		.bind(await hashAppPassword(password))
		.first<{ id: string }>();
	if (!appPassword) return null;

	const token = randomHex(32);
	const now = Date.now();
	await db.batch([
		db
			.prepare(
				`INSERT INTO sessions (token_hash, app_password_id, client, device, device_id, version, created_at, last_seen_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				await sha256Hex(token),
				appPassword.id,
				info.client,
				info.device,
				info.deviceId,
				info.version,
				now,
				now
			),
		db.prepare('UPDATE app_passwords SET last_used_at = ? WHERE id = ?').bind(now, appPassword.id)
	]);
	return token;
}

export async function logout(db: D1Database, session: Session): Promise<void> {
	memo.delete(`session:${session.tokenHash}`);
	await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
}

export async function createAppPassword(
	db: D1Database,
	label: string
): Promise<{ id: string; password: string }> {
	const id = randomHex(8);
	const password = generateAppPassword();
	await db
		.prepare('INSERT INTO app_passwords (id, label, hash, created_at) VALUES (?, ?, ?, ?)')
		.bind(id, label, await hashAppPassword(password), Date.now())
		.run();
	return { id, password };
}

export async function listAppPasswords(db: D1Database): Promise<AppPassword[]> {
	const { results } = await db
		.prepare(
			'SELECT id, label, created_at, last_used_at FROM app_passwords ORDER BY created_at DESC'
		)
		.all<{ id: string; label: string; created_at: number; last_used_at: number | null }>();
	return results.map((row) => ({
		id: row.id,
		label: row.label,
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at
	}));
}

/** Deleting the password cascades to its sessions; the isolate cache is cleared so revocation applies at once here. */
export async function revokeAppPassword(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM app_passwords WHERE id = ?').bind(id).run();
	memo.clear();
}

export async function listSessions(
	db: D1Database
): Promise<(Session & { label: string; createdAt: number })[]> {
	const { results } = await db
		.prepare(
			`SELECT sessions.*, app_passwords.label FROM sessions
			JOIN app_passwords ON app_passwords.id = sessions.app_password_id
			ORDER BY sessions.last_seen_at DESC`
		)
		.all<SessionRow & { label: string }>();
	return results.map((row) => ({
		tokenHash: row.token_hash,
		appPasswordId: row.app_password_id,
		client: row.client,
		device: row.device,
		deviceId: row.device_id,
		version: row.version,
		lastSeenAt: row.last_seen_at,
		createdAt: row.created_at,
		label: row.label
	}));
}

export async function revokeSession(db: D1Database, tokenHash: string): Promise<void> {
	memo.delete(`session:${tokenHash}`);
	await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}
