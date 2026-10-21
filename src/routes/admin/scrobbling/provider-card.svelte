<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import CopyButton from '#lib/components/copy-button.svelte';
	import StatusDot from '#lib/components/status-dot.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { credentialsSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import { reportFailure } from '#lib/forms.js';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
	import WarningIcon from 'phosphor-svelte/lib/Warning';
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

	let { provider }: { provider: Provider } = $props();

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => provider.form),
		{
			validators: zod4Client(credentialsSchema),
			onUpdated: ({ form }) => {
				if (form.valid && form.message) toast.success(form.message);
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;

	let editing = $state(false);
	let pollForm = $state<HTMLFormElement>();

	const step = $derived(
		provider.account ? 3 : provider.device ? 2 : provider.clientId && !editing ? 2 : 1
	);
	const steps = ['API app', 'Authorize', 'Syncing'];

	// While a device code is pending, ask the provider at the interval it requested.
	$effect(() => {
		const device = provider.device;
		if (!device || !pollForm) return;
		const timer = setInterval(() => pollForm?.requestSubmit(), Math.max(device.interval, 5) * 1000);
		return () => clearInterval(timer);
	});
</script>

<section class="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card">
	<header class="flex items-center gap-4 p-5 sm:p-7">
		<span
			class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
		>
			<ClockCounterClockwiseIcon class="size-6" weight="duotone" />
		</span>
		<div class="min-w-0 flex-1">
			<h2 class="text-lg font-semibold tracking-tight">{provider.name}</h2>
			<p class="truncate text-sm text-muted-foreground">
				{#if provider.account}
					{provider.account.username ?? 'Connected'} · updated {timeAgo(
						provider.account.updatedAt
					).toLowerCase()}
				{:else}
					Not connected
				{/if}
			</p>
		</div>
		{#if provider.account}
			<span
				class="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs"
			>
				<StatusDot
					tone={provider.account.lastError
						? 'warning'
						: provider.account.active
							? 'success'
							: 'muted'}
				/>
				{provider.account.lastError
					? 'Needs attention'
					: provider.account.active
						? 'Active'
						: 'Paused'}
			</span>
		{/if}
	</header>

	<ol class="grid grid-cols-3 border-y border-border/60 text-xs">
		{#each steps as label, index (label)}
			{@const number = index + 1}
			<li
				class={[
					'flex items-center gap-2 px-5 py-3 sm:px-7',
					number === step ? 'text-foreground' : 'text-muted-foreground',
					index > 0 && 'border-l border-border/60'
				]}
			>
				<span
					class={[
						'flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]',
						number < step || provider.account
							? 'bg-primary text-primary-foreground'
							: number === step
								? 'bg-foreground text-background'
								: 'bg-muted'
					]}
				>
					{#if number < step || (provider.account && number === 3)}<CheckIcon
							class="size-3"
							weight="bold"
						/>{:else}{number}{/if}
				</span>
				<span class="truncate">{label}</span>
			</li>
		{/each}
	</ol>

	<div class="space-y-5 p-5 sm:p-7">
		{#if provider.notice && !provider.account}
			<p class="flex items-start gap-2.5 rounded-xl bg-tram/10 p-3 text-sm">
				<WarningIcon class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-tram" />
				<span class="text-muted-foreground">{provider.notice}</span>
			</p>
		{/if}

		{#if provider.account}
			<div class="flex items-center justify-between gap-4">
				<div class="text-sm">
					<p class="font-medium">Scrobble and read watch state</p>
					<p class="text-muted-foreground">
						Continue Watching, Next Up and watched marks come from here.
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
				<p class="rounded-xl bg-terracotta/10 p-3 text-sm text-terracotta">
					{provider.account.lastError}
				</p>
			{/if}
			<form
				method="POST"
				action="?/disconnect"
				use:enhance={({ cancel }) => {
					if (!confirm(`Disconnect ${provider.name}?`)) cancel();
				}}
			>
				<input type="hidden" name="provider" value={provider.id} />
				<Button type="submit" variant="destructive" size="sm">Disconnect</Button>
			</form>
		{:else if provider.device}
			<div class="rounded-2xl border border-border/70 bg-background/50 p-5 text-center">
				<p class="text-sm text-muted-foreground">
					Enter this code at {new URL(provider.device.verificationUrl).host}
				</p>
				<div class="mt-3 flex items-center justify-center gap-2">
					<span class="font-mono text-3xl font-medium tracking-[0.3em] sm:text-4xl"
						>{provider.device.userCode}</span
					>
					<CopyButton value={provider.device.userCode} label="Copy code" />
				</div>
				<div class="mt-5 flex flex-wrap items-center justify-center gap-2">
					<Button href={provider.device.verificationUrl} target="_blank" rel="external noreferrer">
						Open {new URL(provider.device.verificationUrl).host}
						<ArrowSquareOutIcon />
					</Button>
					<form method="POST" action="?/cancel" use:enhance>
						<input type="hidden" name="provider" value={provider.id} />
						<Button type="submit" variant="ghost">Cancel</Button>
					</form>
				</div>
				<p class="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
					<Spinner class="size-3" /> Waiting for approval
				</p>
			</div>
			<form
				method="POST"
				action="?/poll"
				use:enhance={reportFailure}
				bind:this={pollForm}
				class="hidden"
			>
				<input type="hidden" name="provider" value={provider.id} />
			</form>
		{:else if step === 2}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-muted-foreground">
					Using client <span class="font-mono text-foreground"
						>{provider.clientId?.slice(0, 10)}…</span
					>
					<button
						type="button"
						class="ml-1 underline underline-offset-4 hover:text-foreground"
						onclick={() => (editing = true)}
					>
						change
					</button>
				</p>
				<form method="POST" action="?/connect" use:enhance={reportFailure}>
					<input type="hidden" name="provider" value={provider.id} />
					<Button type="submit">Connect {provider.name}</Button>
				</form>
			</div>
		{:else}
			<form
				method="POST"
				action="?/credentials"
				use:formEnhance
				class="space-y-4"
				onsubmit={() => (editing = false)}
			>
				<input type="hidden" name="provider" value={provider.id} />
				<p class="text-sm text-muted-foreground">
					Create an API app at
					<a
						class="text-foreground underline underline-offset-4"
						href={provider.credentialsUrl}
						target="_blank"
						rel="external noreferrer">{new URL(provider.credentialsUrl).host}</a
					>
					with the redirect URI
					<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
						>urn:ietf:wg:oauth:2.0:oob</code
					>.
				</p>
				<div class="grid gap-3 sm:grid-cols-2">
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
				<Form.Button disabled={$submitting}
					>{#if $submitting}<Spinner />{/if} Save and continue</Form.Button
				>
			</form>
		{/if}
	</div>
</section>
