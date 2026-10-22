<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import CopyButton from '#lib/components/copy-button.svelte';
	import Notice from '#lib/components/notice.svelte';
	import Section from '#lib/components/section.svelte';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { credentialsSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import { reportFailure } from '#lib/forms.js';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
	import type { z } from 'zod';

	interface Provider {
		id: string;
		name: string;
		notice: string | null;
		credentialsUrl: string;
		clientId: string | null;
		account: {
			username: string | null;
			active: boolean;
			lastError: string | null;
			updatedAt: number;
		} | null;
		device: {
			userCode: string;
			verificationUrl: string;
			interval: number;
			expiresAt: number;
		} | null;
		form: SuperValidated<z.infer<typeof credentialsSchema>>;
	}

	const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

	let { provider }: { provider: Provider } = $props();

	let editing = $state(false);
	let connecting = $state(false);
	let confirmDisconnect = $state(false);
	let pollForm = $state<HTMLFormElement>();
	let disconnectForm = $state<HTMLFormElement>();
	let now = $state(Date.now());

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => provider.form),
		{
			validators: zod4Client(credentialsSchema),
			onUpdated: ({ form }) => {
				if (!form.valid) return;
				editing = false;
				if (form.message) toast.success(form.message);
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;

	const expired = $derived(provider.device ? provider.device.expiresAt <= now : false);
	const remaining = $derived.by(() => {
		if (!provider.device) return '';
		const seconds = Math.max(0, Math.round((provider.device.expiresAt - now) / 1000));
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	});
	const stage = $derived(
		provider.account
			? 'connected'
			: provider.device
				? 'authorize'
				: provider.clientId && !editing
					? 'ready'
					: 'credentials'
	);
	const stateLine = $derived(
		{
			credentials: 'Step 1 of 3 · API app',
			ready: 'Step 2 of 3 · Authorize',
			authorize: 'Step 2 of 3 · Authorize',
			connected: provider.account?.lastError
				? 'Connected · last request failed'
				: `Connected as ${provider.account?.username ?? 'unknown'} · ${provider.account?.active ? 'active' : 'paused'}`
		}[stage]
	);

	let pollDelay = 5000;

	// While a device code is pending, tick the countdown and poll at the interval the provider asks for.
	$effect(() => {
		const device = provider.device;
		if (!device) return;
		pollDelay = Math.max(device.interval, 5) * 1000;
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			timer = setTimeout(() => {
				if (Date.now() < device.expiresAt) pollForm?.requestSubmit();
				schedule();
			}, pollDelay);
		};
		schedule();
		const clock = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearTimeout(timer);
			clearInterval(clock);
		};
	});

	const pollEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success' && result.data?.status === 'slow_down') pollDelay += 5000;
			if (result.type === 'failure' && typeof result.data?.error === 'string')
				toast.error(result.data.error);
			await update();
		};
	};

	const connectEnhance: SubmitFunction = () => {
		connecting = true;
		return async ({ result, update }) => {
			connecting = false;
			if (result.type === 'failure' && typeof result.data?.error === 'string')
				toast.error(result.data.error);
			await update();
		};
	};
</script>

<Section id="provider-{provider.id}" title={provider.name}>
	{#snippet description()}
		<p class={provider.account?.lastError ? 'text-terracotta' : ''}>{stateLine}</p>
	{/snippet}

	{#if provider.notice && stage !== 'connected'}
		<Notice tone="warning" class="mb-6">{provider.notice}</Notice>
	{/if}

	{#if stage === 'connected' && provider.account}
		<div class="max-w-2xl divide-y border-y text-sm">
			<div class="flex items-center gap-4 py-3">
				<div class="min-w-0 flex-1">
					<p class="font-medium">Scrobble and read watch state</p>
					<p class="text-xs text-muted-foreground">
						Updated {timeAgo(provider.account.updatedAt).toLowerCase()}
					</p>
				</div>
				<ToggleForm
					action="?/activate"
					id={provider.id}
					checked={provider.account.active}
					label="Use {provider.name}"
				/>
			</div>
			{#if provider.account.lastError}
				<p class="py-3 text-xs break-words text-terracotta">{provider.account.lastError}</p>
			{/if}
		</div>
		<Button
			variant="ghost"
			class="mt-4 text-destructive hover:text-destructive"
			onclick={() => (confirmDisconnect = true)}
		>
			Disconnect
		</Button>
		<form method="POST" action="?/disconnect" use:enhance bind:this={disconnectForm} class="hidden">
			<input type="hidden" name="provider" value={provider.id} />
		</form>
		<ConfirmDialog
			bind:open={confirmDisconnect}
			title="Disconnect {provider.name}?"
			description="Progress and watched state stop syncing. Your history on {provider.name} is kept."
			confirmLabel="Disconnect"
			onConfirm={() => disconnectForm?.requestSubmit()}
		/>
	{:else if stage === 'authorize' && provider.device}
		<div class="max-w-2xl">
			{#if expired}
				<p class="text-sm text-muted-foreground">The code expired.</p>
				<form method="POST" action="?/connect" use:enhance={reportFailure} class="mt-3">
					<input type="hidden" name="provider" value={provider.id} />
					<Button type="submit">Get a new code</Button>
				</form>
			{:else}
				<p class="text-sm text-muted-foreground">
					Enter this code at {new URL(provider.device.verificationUrl).host}. Expires in
					<span class="font-mono tabular-nums">{remaining}</span>.
				</p>
				<div class="mt-4 flex items-center gap-2">
					<span class="font-mono text-4xl font-medium tracking-[0.25em]"
						>{provider.device.userCode}</span
					>
					<CopyButton value={provider.device.userCode} label="Copy code" />
				</div>
				<div class="mt-6 flex flex-wrap items-center gap-2">
					<Button href={provider.device.verificationUrl} target="_blank" rel="external noreferrer">
						Open {new URL(provider.device.verificationUrl).host}
						<ArrowSquareOutIcon />
					</Button>
					<form method="POST" action="?/cancel" use:enhance>
						<input type="hidden" name="provider" value={provider.id} />
						<Button type="submit" variant="ghost">Cancel</Button>
					</form>
					<span class="ml-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
						<Spinner class="size-3" /> Waiting for approval
					</span>
				</div>
				<form
					method="POST"
					action="?/poll"
					use:enhance={pollEnhance}
					bind:this={pollForm}
					class="hidden"
				>
					<input type="hidden" name="provider" value={provider.id} />
				</form>
			{/if}
		</div>
	{:else if stage === 'ready'}
		<div class="flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-3">
			<form method="POST" action="?/connect" use:enhance={connectEnhance}>
				<input type="hidden" name="provider" value={provider.id} />
				<SubmitButton pending={connecting}>Connect {provider.name}</SubmitButton>
			</form>
			<p class="text-sm text-muted-foreground">
				API app <span class="font-mono text-foreground">{provider.clientId?.slice(0, 8)}…</span>
				<Button variant="link" class="h-auto px-1" onclick={() => (editing = true)}>Change</Button>
			</p>
		</div>
	{:else}
		<form method="POST" action="?/credentials" use:formEnhance class="max-w-2xl space-y-5">
			<input type="hidden" name="provider" value={provider.id} />
			<p class="text-sm text-muted-foreground">
				Create an API app at
				<a
					class="text-primary underline-offset-4 hover:underline"
					href={provider.credentialsUrl}
					target="_blank"
					rel="external noreferrer">{new URL(provider.credentialsUrl).host}</a
				>. Use this redirect URI:
			</p>
			<div class="flex items-center gap-1">
				<code class="rounded-md bg-muted px-2 py-1 font-mono text-xs">{REDIRECT_URI}</code>
				<CopyButton value={REDIRECT_URI} label="Copy redirect URI" />
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<Form.Field {form} name="clientId">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Client ID</Form.Label>
							<Input
								{...props}
								bind:value={$formData.clientId}
								autocomplete="off"
								class="font-mono"
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
				<Form.Field {form} name="clientSecret">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Client secret</Form.Label>
							<Input
								{...props}
								type="password"
								bind:value={$formData.clientSecret}
								autocomplete="off"
								class="font-mono"
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>
			<div class="flex gap-2">
				<SubmitButton pending={$submitting}>Save</SubmitButton>
				{#if provider.clientId}
					<Button variant="ghost" onclick={() => (editing = false)}>Cancel</Button>
				{/if}
			</div>
		</form>
	{/if}
</Section>
