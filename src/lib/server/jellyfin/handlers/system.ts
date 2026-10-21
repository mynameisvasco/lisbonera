import type { PublicSystemInfo, SystemInfo } from '@jellyfin/sdk/lib/generated-client/models';
import { json } from '../../http';
import type { JfContext } from '../context';
import { PRODUCT_NAME, SERVER_NAME, SERVER_VERSION } from '../dto';
import type { Router } from '../router';

function publicInfo(c: JfContext): PublicSystemInfo {
	return {
		LocalAddress: c.origin,
		ServerName: SERVER_NAME,
		Version: SERVER_VERSION,
		ProductName: PRODUCT_NAME,
		OperatingSystem: '',
		Id: c.dto.serverId,
		StartupWizardCompleted: true
	};
}

export function systemRoutes(router: Router): void {
	router.on('GET', '/system/info/public', (c) => json(publicInfo(c)), { public: true });

	router.on('GET', '/system/info', (c) => {
		const info: SystemInfo = {
			...publicInfo(c),
			OperatingSystemDisplayName: '',
			PackageName: '',
			HasPendingRestart: false,
			IsShuttingDown: false,
			SupportsLibraryMonitor: false,
			WebSocketPortNumber: 443,
			CompletedInstallations: [],
			CanSelfRestart: false,
			CanLaunchWebBrowser: false,
			ProgramDataPath: '',
			WebPath: '',
			ItemsByNamePath: '',
			CachePath: '',
			LogPath: '',
			InternalMetadataPath: '',
			TranscodingTempPath: '',
			CastReceiverApplications: [],
			HasUpdateAvailable: false,
			EncoderLocation: 'NotFound',
			SystemArchitecture: 'X64'
		};
		return json(info);
	});

	router.on(['GET', 'POST'], '/system/ping', () => json(PRODUCT_NAME), { public: true });
	router.on('GET', '/system/endpoint', () => json({ IsLocal: false, IsInNetwork: false }));
	router.on(
		'GET',
		'/branding/configuration',
		() => json({ LoginDisclaimer: '', CustomCss: '', SplashscreenEnabled: false }),
		{ public: true }
	);
	router.on(
		'GET',
		['/branding/css', '/branding/css.css'],
		() => new Response('', { headers: { 'content-type': 'text/css' } }),
		{ public: true }
	);
	router.on('GET', '/quickconnect/enabled', () => json(false), { public: true });
	router.on('GET', '/users/public', () => json([]), { public: true });
}
