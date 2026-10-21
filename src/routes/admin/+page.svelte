<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyButton from '#lib/components/copy-button.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clients = [
		{
			name: 'Infuse',
			steps: 'Settings → Shares → Add → Jellyfin. Enter the address, username and an app password.'
		},
		{
			name: 'Swiftfin',
			steps: 'Add server with the address, then sign in with the username and an app password.'
		},
		{ name: 'Findroid, Jellyfin Android TV', steps: 'Add server with the address, then sign in.' },
		{
			name: 'Jellyfin Web',
			steps:
				'Open your Jellyfin Web client and add this address as a server. MKV and HEVC may not play in browsers.'
		}
	];
</script>

<svelte:head><title>Connection · Lisbonera</title></svelte:head>

<PageHeader title="Connection" description="Use these details in any Jellyfin client." />

<div class="grid gap-4 md:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Server</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm">
			<div>
				<p class="text-muted-foreground">Address</p>
				<div class="flex items-center gap-1">
					<code class="font-mono">{data.server}</code>
					<CopyButton value={data.server} label="Copy address" />
				</div>
			</div>
			<div>
				<p class="text-muted-foreground">Username</p>
				<div class="flex items-center gap-1">
					<code class="font-mono">{data.username}</code>
					<CopyButton value={data.username} label="Copy username" />
				</div>
			</div>
			<div>
				<p class="text-muted-foreground">Password</p>
				<p>
					An app password from <a
						class="underline underline-offset-4"
						href={resolve('/admin/devices')}>Devices</a
					>.
				</p>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Status</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="grid grid-cols-2 gap-y-2 text-sm">
				<dt class="text-muted-foreground">Enabled addons</dt>
				<dd class="text-right tabular-nums">{data.counts.addons}</dd>
				<dt class="text-muted-foreground">Enabled libraries</dt>
				<dd class="text-right tabular-nums">{data.counts.libraries}</dd>
				<dt class="text-muted-foreground">App passwords</dt>
				<dd class="text-right tabular-nums">{data.counts.devices}</dd>
				<dt class="text-muted-foreground">Scrobbling</dt>
				<dd class="text-right capitalize">{data.scrobbler ?? 'Off'}</dd>
			</dl>
		</Card.Content>
	</Card.Root>
</div>

<h2 class="mt-8 mb-3 text-sm font-medium">Clients</h2>
<Table.Root>
	<Table.Body>
		{#each clients as client (client.name)}
			<Table.Row>
				<Table.Cell class="w-56 align-top font-medium">{client.name}</Table.Cell>
				<Table.Cell class="whitespace-normal text-muted-foreground">{client.steps}</Table.Cell>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
