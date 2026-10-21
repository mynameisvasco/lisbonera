import type { AuthenticationResult } from '@jellyfin/sdk/lib/generated-client/models';
import { clientInfo, login, logout } from '../../auth/client';
import { json, noContent, readJson, unauthorized } from '../../http';
import { getDisplayPrefs, setDisplayPrefs } from '../../store';
import type { JfContext } from '../context';
import { userDto } from '../dto';
import type { Router } from '../router';

async function authenticateByName(c: JfContext): Promise<Response> {
	const ip = c.request.headers.get('cf-connecting-ip') ?? 'unknown';
	const { success } = await c.env.LOGIN_LIMITER.limit({ key: ip });
	if (!success) return json({ message: 'Too many login attempts' }, 429);

	const body = await readJson<{ Username: string; Pw: string; Password: string }>(c.request);
	const info = clientInfo(c.request);
	const token = await login(c.env.DB, c.username, body.Username ?? '', body.Pw ?? body.Password ?? '', info);
	if (!token) return unauthorized();

	const now = new Date().toISOString();
	const result: AuthenticationResult = {
		User: userDto(c.dto, c.username),
		AccessToken: token,
		ServerId: c.dto.serverId,
		SessionInfo: {
			PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: 'RepeatNone', PlaybackOrder: 'Default' },
			AdditionalUsers: [],
			Capabilities: { PlayableMediaTypes: [], SupportedCommands: [], SupportsMediaControl: false, SupportsPersistentIdentifier: true },
			RemoteEndPoint: ip,
			PlayableMediaTypes: [],
			Id: token.slice(0, 32),
			UserId: c.dto.userId,
			UserName: c.username,
			Client: info.client,
			LastActivityDate: now,
			LastPlaybackCheckIn: now,
			DeviceName: info.device,
			DeviceId: info.deviceId,
			ApplicationVersion: info.version,
			IsActive: true,
			SupportsMediaControl: false,
			SupportsRemoteControl: false,
			NowPlayingQueue: [],
			HasCustomDeviceName: false,
			ServerId: c.dto.serverId,
			SupportedCommands: []
		}
	};
	return json(result);
}

function defaultPrefs(id: string, client: string) {
	return {
		Id: id,
		SortBy: 'SortName',
		RememberIndexing: false,
		PrimaryImageHeight: 250,
		PrimaryImageWidth: 250,
		CustomPrefs: {},
		ScrollDirection: 'Horizontal',
		ShowBackdrop: true,
		RememberSorting: false,
		SortOrder: 'Ascending',
		ShowSidebar: false,
		Client: client
	};
}

export function userRoutes(router: Router): void {
	router.on('POST', '/users/authenticatebyname', authenticateByName, { public: true });
	router.on('GET', ['/users/me', '/users/:userId'], (c) => json(userDto(c.dto, c.username)));
	router.on('GET', '/users', (c) => json([userDto(c.dto, c.username)]));
	router.on('POST', '/sessions/logout', async (c) => {
		if (c.session) await logout(c.env.DB, c.session);
		return noContent();
	});

	router.on('GET', '/displaypreferences/:id', async (c) => {
		const client = c.query.get('client') ?? 'emby';
		return json((await getDisplayPrefs(c.env.DB, c.params.id, client)) ?? defaultPrefs(c.params.id, client));
	});
	router.on('POST', '/displaypreferences/:id', async (c) => {
		const client = c.query.get('client') ?? 'emby';
		await setDisplayPrefs(c.env.DB, c.params.id, client, { ...defaultPrefs(c.params.id, client), ...(await readJson(c.request)) });
		return noContent();
	});
}
