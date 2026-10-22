<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import CopyButton from '#lib/components/copy-button.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import Row from '#lib/components/row.svelte';
	import RowMenu from '#lib/components/row-menu.svelte';
	import Rows from '#lib/components/rows.svelte';
	import Section from '#lib/components/section.svelte';
	import StatusDot from '#lib/components/status-dot.svelte';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { appPasswordSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const apps = {
		Infuse: [
			'In Infuse, open Settings → Shares → Add Share → Jellyfin.',
			'Enter the address, username and password.'
		],
		Swiftfin: [
			'In Swiftfin, choose Connect to Server and enter the address.',
			'Sign in with the username and password.'
		],
		Findroid: [
			'In Findroid or Jellyfin for Android TV, add a server with the address.',
			'Sign in with the username and password.'
		],
		'Jellyfin Web': [
			'In Jellyfin Web, choose Add Server and enter the address.',
			'Sign in. MKV and HEVC may not play in a browser.'
		]
	} as const;
	type App = keyof typeof apps;

	let app = $state<App>('Infuse');
	let labelTouched = $state(false);
	let created = $state<{ label: string; password: string } | null>(null);
	let revoking = $state<{ id: string; label: string } | null>(null);
	let confirmRevoke = $state(false);
	let revokeForm = $state<HTMLFormElement>();
	const now = Date.now();

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(appPasswordSchema),
			resetForm: false,
			onResult: ({ result }) => {
				if (result.type === 'success' && result.data?.created) created = result.data.created;
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;

	function chooseApp(value: string) {
		if (!(value in apps)) return;
		app = value as App;
		if (!labelTouched) $formData.label = app;
	}

	function reset() {
		created = null;
		labelTouched = false;
		$formData.label = app;
	}
</script>

<svelte:head><title>Devices · Lisbonera</title></svelte:head>

<PageHeader
	title="Devices"
	meta="Each device signs in with its own password, so you can revoke one at a time."
/>

<Section id="add-device" title="Add a device">
	<ToggleGroup.Root
		type="single"
		variant="outline"
		value={app}
		onValueChange={(value) => value && chooseApp(value)}
		class="mb-6 flex w-full flex-wrap sm:w-auto"
		aria-label="App"
	>
		{#each Object.keys(apps) as name (name)}
			<ToggleGroup.Item value={name} class="flex-1 px-3 sm:flex-none">{name}</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	<ol class="space-y-6 text-sm">
		<li class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
			<span class="font-mono text-xs leading-5 text-muted-foreground">1</span>
			<div class="min-w-0">
				<p class="mb-2">Create a password for this device.</p>
				{#if created}
					<p class="text-muted-foreground">Created for {created.label}.</p>
				{:else}
					<form
						method="POST"
						action="?/create"
						use:formEnhance
						class="flex max-w-md items-start gap-2"
					>
						<Form.Field {form} name="label" class="flex-1">
							<Form.Control>
								{#snippet children({ props })}
									<Form.Label class="sr-only">Device name</Form.Label>
									<Input
										{...props}
										bind:value={$formData.label}
										oninput={() => (labelTouched = true)}
										placeholder="Living room Apple TV"
										autocomplete="off"
									/>
								{/snippet}
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
						<SubmitButton pending={$submitting}>Create</SubmitButton>
					</form>
				{/if}
			</div>
		</li>

		{#each apps[app] as step, index (step)}
			<li class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
				<span class="font-mono text-xs leading-5 text-muted-foreground">{index + 2}</span>
				<p class="min-w-0">{step}</p>
			</li>
		{/each}
	</ol>

	<dl class="mt-6 max-w-xl divide-y border-y text-sm">
		{#each [['Address', data.server], ['Username', data.username]] as [term, value] (term)}
			<div class="flex items-center gap-3 py-2">
				<dt class="w-24 shrink-0 text-muted-foreground">{term}</dt>
				<dd class="min-w-0 flex-1 truncate font-mono">{value}</dd>
				<CopyButton {value} label="Copy {term.toLowerCase()}" />
			</div>
		{/each}
		<div class="flex items-center gap-3 py-2">
			<dt class="w-24 shrink-0 text-muted-foreground">Password</dt>
			{#if created}
				<dd class="min-w-0 flex-1 truncate font-mono font-medium">{created.password}</dd>
				<CopyButton value={created.password} label="Copy password" />
			{:else}
				<dd class="min-w-0 flex-1 text-muted-foreground">Created in step 1</dd>
			{/if}
		</div>
	</dl>

	{#if created}
		<p class="mt-3 text-xs text-muted-foreground">
			The password is shown once. Dashes and letter case are ignored when typing it.
		</p>
		<div class="mt-4 flex gap-2">
			<Button onclick={reset}>Done</Button>
			<Button variant="ghost" onclick={reset}>Add another</Button>
		</div>
	{/if}
</Section>

<Section id="devices" title="Signed-in devices">
	{#if data.devices.length}
		<Rows>
			{#each data.devices as device (device.id)}
				<Row
					title={device.label}
					meta="{device.lastUsedAt
						? `Last sign-in ${timeAgo(device.lastUsedAt).toLowerCase()}`
						: 'Never signed in'} · created {timeAgo(device.createdAt).toLowerCase()}"
				>
					{#snippet trailing()}
						<RowMenu label="Actions for {device.label}">
							<DropdownMenu.Item
								variant="destructive"
								onSelect={() => {
									revoking = { id: device.id, label: device.label };
									confirmRevoke = true;
								}}
							>
								Revoke password
							</DropdownMenu.Item>
						</RowMenu>
					{/snippet}
					{#if device.sessions.length}
						<ul class="mt-2 space-y-1">
							{#each device.sessions as session (session.tokenHash)}
								<li class="flex min-h-8 items-center gap-2 text-xs">
									<StatusDot tone={now - session.lastSeenAt < 3600_000 ? 'success' : 'muted'} />
									<span class="min-w-0 flex-1 truncate">
										{session.client}
										<span class="text-muted-foreground"
											>{session.version} · {session.device} · {timeAgo(
												session.lastSeenAt
											).toLowerCase()}</span
										>
									</span>
									<form method="POST" action="?/signOut" use:enhance>
										<input type="hidden" name="tokenHash" value={session.tokenHash} />
										<Button type="submit" variant="ghost" size="sm">Sign out</Button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				</Row>
			{/each}
		</Rows>
	{:else}
		<EmptyState>No devices yet. Create a password above to add one.</EmptyState>
	{/if}
</Section>

<form method="POST" action="?/revoke" use:enhance bind:this={revokeForm} class="hidden">
	<input type="hidden" name="id" value={revoking?.id ?? ''} />
</form>
<ConfirmDialog
	bind:open={confirmRevoke}
	title="Revoke {revoking?.label}?"
	description="Apps signed in with this password are signed out and cannot sign in with it again."
	confirmLabel="Revoke password"
	onConfirm={() => revokeForm?.requestSubmit()}
/>
