import { UpstreamError, type Scope } from '../scope';
import {
	ensureCatalogLibraries,
	insertAddon,
	listAddons,
	setAddonError,
	updateAddonManifest
} from '../store';
import { fetchManifest, isBrowsable, normalizeAddonUrl } from '../stremio/client';
import type { Manifest } from '../stremio/types';

export class AddonError extends Error {}

function catalogLibraries(manifest: Manifest) {
	return manifest.catalogs
		.filter(
			(catalog) => (catalog.type === 'movie' || catalog.type === 'series') && isBrowsable(catalog)
		)
		.map((catalog) => ({
			type: catalog.type as 'movie' | 'series',
			id: catalog.id,
			name: `${catalog.name ?? catalog.id} ${catalog.type === 'movie' ? 'Movies' : 'Series'}`
		}));
}

async function loadManifest(scope: Scope, url: string): Promise<Manifest> {
	try {
		return await fetchManifest(scope, url);
	} catch (error) {
		throw new AddonError(
			error instanceof UpstreamError
				? `Could not load manifest: ${error.message}`
				: 'Could not load manifest'
		);
	}
}

/** Adds an addon and a library for each of its browsable catalogs. New catalogs start enabled. */
export async function addAddon(scope: Scope, input: string): Promise<Manifest> {
	let url: string;
	try {
		url = normalizeAddonUrl(input);
	} catch {
		throw new AddonError('Enter a valid http(s) or stremio:// URL');
	}
	const existing = await listAddons(scope.env.DB);
	if (existing.some((addon) => addon.url === url))
		throw new AddonError('This addon is already installed');

	const manifest = await loadManifest(scope, url);
	if (manifest.behaviorHints?.configurationRequired) {
		throw new AddonError(
			'This addon needs to be configured first. Paste the URL of your configured manifest.'
		);
	}
	const id = await insertAddon(scope.env.DB, url, manifest);
	await ensureCatalogLibraries(scope.env.DB, id, catalogLibraries(manifest), true);
	return manifest;
}

/** Re-reads the manifest and adds libraries (disabled) for catalogs that appeared since. */
export async function refreshAddon(scope: Scope, id: string): Promise<void> {
	const addon = (await listAddons(scope.env.DB)).find((item) => item.id === id);
	if (!addon) throw new AddonError('Addon not found');
	try {
		const manifest = await loadManifest(scope, addon.url);
		const firstLoad = addon.manifest === null;
		await updateAddonManifest(scope.env.DB, id, manifest);
		await ensureCatalogLibraries(scope.env.DB, id, catalogLibraries(manifest), firstLoad);
	} catch (error) {
		await setAddonError(scope.env.DB, id, error instanceof Error ? error.message : String(error));
		throw error;
	}
}

/** Addons seeded by the migration (Cinemeta) have no manifest until first loaded. */
export async function loadPendingManifests(scope: Scope): Promise<void> {
	const pending = (await listAddons(scope.env.DB)).filter(
		(addon) => addon.manifest === null && addon.lastError === null
	);
	await Promise.allSettled(pending.map((addon) => refreshAddon(scope, addon.id)));
}
