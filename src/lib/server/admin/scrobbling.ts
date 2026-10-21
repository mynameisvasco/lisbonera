import { getProviderDefinition, loadCredentials, saveAccount } from '../scrobble/service';
import type { DeviceCode } from '../scrobble/types';
import { getSetting, setSetting } from '../store';

export interface PendingDevice {
	deviceCode: string;
	userCode: string;
	verificationUrl: string;
	interval: number;
	expiresAt: number;
}

function deviceKey(provider: string): string {
	return `scrobble:${provider}:device`;
}

export async function pendingDevice(
	db: D1Database,
	provider: string
): Promise<PendingDevice | null> {
	const stored = await getSetting(db, deviceKey(provider));
	if (!stored) return null;
	const device = JSON.parse(stored) as PendingDevice;
	return device.expiresAt > Date.now() ? device : null;
}

export async function clearDevice(db: D1Database, provider: string): Promise<void> {
	await setSetting(db, deviceKey(provider), null);
}

export async function startConnection(env: Env, provider: string): Promise<PendingDevice> {
	const definition = getProviderDefinition(provider);
	const credentials = await loadCredentials(env, provider);
	if (!definition || !credentials) throw new Error('Save the API credentials first');
	const code: DeviceCode = await definition.startDeviceAuth(credentials);
	const device: PendingDevice = {
		deviceCode: code.deviceCode,
		userCode: code.userCode,
		verificationUrl: code.verificationUrl,
		interval: code.interval,
		expiresAt: Date.now() + code.expiresIn * 1000
	};
	await setSetting(env.DB, deviceKey(provider), JSON.stringify(device));
	return device;
}

/** Returns the new state of the pending connection. */
export async function pollConnection(
	env: Env,
	provider: string
): Promise<'connected' | 'pending' | 'slow_down' | 'failed'> {
	const definition = getProviderDefinition(provider);
	const credentials = await loadCredentials(env, provider);
	const device = await pendingDevice(env.DB, provider);
	if (!definition || !credentials || !device) return 'failed';

	const result = await definition.pollDeviceAuth(credentials, device.deviceCode);
	if (result.status === 'approved') {
		await saveAccount(env, provider, result.tokens, result.username);
		await clearDevice(env.DB, provider);
		return 'connected';
	}
	if (result.status === 'pending' || result.status === 'slow_down') return result.status;
	await clearDevice(env.DB, provider);
	return 'failed';
}
