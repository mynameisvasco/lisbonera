<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import CopyButton from '#lib/components/copy-button.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import StatusDot from '#lib/components/status-dot.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { appPasswordSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import AndroidLogoIcon from 'phosphor-svelte/lib/AndroidLogo';
	import BrowserIcon from 'phosphor-svelte/lib/Browser';
	import DeviceMobileIcon from 'phosphor-svelte/lib/DeviceMobile';
	import DevicesIcon from 'phosphor-svelte/lib/Devices';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';
	import KeyIcon from 'phosphor-svelte/lib/Key';
	import TelevisionSimpleIcon from 'phosphor-svelte/lib/TelevisionSimple';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const apps = [
		{
			id: 'Infuse',
			icon: TelevisionSimpleIcon,
			platforms: 'Apple TV, iPhone, iPad, Mac',
			steps: [
				'Settings → Shares → Add Share',
				'Choose Jellyfin',
				'Enter the address, username and password'
			]
		},
		{
			id: 'Swiftfin',
			icon: DeviceMobileIcon,
			platforms: 'iPhone, iPad, Apple TV',
			steps: ['Connect to Server', 'Enter the address', 'Sign in with the username and password']
		},
		{
			id: 'Findroid',
			icon: AndroidLogoIcon,
			platforms: 'Android, Android TV',
			steps: ['Add server', 'Enter the address', 'Sign in with the username and password']
		},
		{
			id: 'Jellyfin Web',
			icon: BrowserIcon,
			platforms: 'Any browser',
			steps: ['Add Server', 'Enter the address', 'Sign in. MKV and HEVC may not play in browsers']
		}
	] as const;

	let selected = $state<(typeof apps)[number]['id']>('Infuse');
	const app = $derived(apps.find((item) => item.id === selected)!);
	let created = $state<{ label: string; password: string } | null>(null);

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

	function choose(id: typeof selected) {
		selected = id;
		created = null;
		$formData.label = id;
	}

	function iconFor(client: string) {
		const match = apps.find((item) =>
			client.toLowerCase().includes(item.id.split(' ')[0].toLowerCase())
		);
		return match?.icon ?? DevicesIcon;
	}
</script>

<svelte:head><title>Devices · Lisbonera</title></svelte:head>

<PageHeader
	title="Devices"
	description="Every device gets its own app password, so you can sign one out without touching the others."
/>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
	<section class="rounded-[1.75rem] border border-border/70 bg-card p-5 sm:p-7">
		<h2 class="font-semibold tracking-tight">Connect an app</h2>
		<p class="mt-1 text-sm text-muted-foreground">Any Jellyfin app works. These are tested.</p>

		<div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="App">
			{#each apps as item (item.id)}
				<button
					type="button"
					role="radio"
					aria-checked={selected === item.id}
					onclick={() => choose(item.id)}
					class={[
						'flex flex-col items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
						selected === item.id
							? 'border-primary bg-primary/10'
							: 'border-border/70 hover:border-foreground/20 hover:bg-muted/50'
					]}
				>
					<item.icon
						class={['size-6', selected === item.id ? 'text-primary' : 'text-muted-foreground']}
					/>
					<span class="text-sm font-medium">{item.id}</span>
				</button>
			{/each}
		</div>
		<p class="mt-2 text-xs text-muted-foreground">{app.platforms}</p>

		<ol class="mt-6 space-y-2 text-sm">
			{#each app.steps as step, index (step)}
				<li class="flex gap-3">
					<span
						class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground"
						>{index + 1}</span
					>
					<span class="pt-0.5">{step}</span>
				</li>
			{/each}
		</ol>

		<dl class="mt-6 divide-y divide-border/70 rounded-2xl border border-border/70 bg-background/50">
			<div class="flex items-center gap-3 px-4 py-3">
				<dt class="w-24 shrink-0 text-xs text-muted-foreground">Address</dt>
				<dd class="min-w-0 flex-1 truncate font-mono text-sm">{data.server}</dd>
				<CopyButton value={data.server} label="Copy address" />
			</div>
			<div class="flex items-center gap-3 px-4 py-3">
				<dt class="w-24 shrink-0 text-xs text-muted-foreground">Username</dt>
				<dd class="min-w-0 flex-1 truncate font-mono text-sm">{data.username}</dd>
				<CopyButton value={data.username} label="Copy username" />
			</div>
			<div class="flex items-center gap-3 px-4 py-3">
				<dt class="w-24 shrink-0 text-xs text-muted-foreground">Password</dt>
				{#if created}
					<dd class="min-w-0 flex-1 truncate font-mono text-sm font-medium text-primary">
						{created.password}
					</dd>
					<CopyButton value={created.password} label="Copy password" />
				{:else}
					<dd class="min-w-0 flex-1 text-sm text-muted-foreground">Create one below</dd>
				{/if}
			</div>
		</dl>

		{#if created}
			<p class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
				<KeyIcon class="size-3.5" /> Shown once. Dashes and letter case don't matter when you type it.
			</p>
		{:else}
			<form
				method="POST"
				action="?/create"
				use:formEnhance
				class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start"
			>
				<Form.Field {form} name="label" class="flex-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="sr-only">Device name</Form.Label>
							<Input
								{...props}
								bind:value={$formData.label}
								placeholder="Living room Apple TV"
								autocomplete="off"
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
				<Form.Button disabled={$submitting}>
					{#if $submitting}<Spinner />{:else}<KeyIcon />{/if} Create password
				</Form.Button>
			</form>
		{/if}
	</section>

	<section>
		<h2 class="mb-3 font-semibold tracking-tight">Your devices</h2>
		{#if data.devices.length}
			<ul class="space-y-3">
				{#each data.devices as device (device.id)}
					{@const Icon = iconFor(device.sessions[0]?.client ?? device.label)}
					<li class="rounded-2xl border border-border/70 bg-card p-4">
						<div class="flex items-center gap-3">
							<span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
								<Icon class="size-5 text-muted-foreground" />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{device.label}</p>
								<p class="truncate text-xs text-muted-foreground">
									Created {timeAgo(device.createdAt)} · last sign-in {timeAgo(
										device.lastUsedAt
									).toLowerCase()}
								</p>
							</div>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon-sm"
											aria-label="More for {device.label}"
										>
											<DotsThreeIcon weight="bold" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<form
										method="POST"
										action="?/revoke"
										use:enhance={({ cancel }) => {
											if (!confirm(`Revoke ${device.label}? Apps using it are signed out.`))
												cancel();
										}}
									>
										<input type="hidden" name="id" value={device.id} />
										<DropdownMenu.Item variant="destructive">
											{#snippet child({ props })}
												<button type="submit" {...props} class="{props.class} w-full"
													>Revoke password</button
												>
											{/snippet}
										</DropdownMenu.Item>
									</form>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
						{#if device.sessions.length}
							<ul class="mt-3 space-y-1 border-t border-border/60 pt-3">
								{#each device.sessions as session (session.tokenHash)}
									<li class="flex items-center gap-2 text-xs">
										<StatusDot
											tone={Date.now() - session.lastSeenAt < 3600_000 ? 'success' : 'muted'}
										/>
										<span class="min-w-0 flex-1 truncate">
											{session.client}
											<span class="text-muted-foreground">{session.version} · {session.device}</span
											>
										</span>
										<span class="shrink-0 text-muted-foreground">{timeAgo(session.lastSeenAt)}</span
										>
										<form method="POST" action="?/signOut" use:enhance>
											<input type="hidden" name="tokenHash" value={session.tokenHash} />
											<Button type="submit" variant="ghost" size="xs">Sign out</Button>
										</form>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<Empty.Root class="rounded-2xl border border-dashed">
				<Empty.Header>
					<Empty.Media variant="icon"><DevicesIcon /></Empty.Media>
					<Empty.Title>No devices yet</Empty.Title>
					<Empty.Description
						>Create a password on the left and sign in from your app.</Empty.Description
					>
				</Empty.Header>
			</Empty.Root>
		{/if}
	</section>
</div>
