<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import WarningIcon from 'phosphor-svelte/lib/Warning';
	import { credentialsSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import { reportFailure } from '#lib/forms.js';
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

	let pollForm = $state<HTMLFormElement>();

	// While a device code is pending, ask the provider at the interval it requested.
	$effect(() => {
		const device = provider.device;
		if (!device || !pollForm) return;
		const timer = setInterval(() => pollForm?.requestSubmit(), Math.max(device.interval, 5) * 1000);
		return () => clearInterval(timer);
	});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			{provider.name}
			{#if provider.account?.active}
				<Badge>Active</Badge>
			{:else if provider.account}
				<Badge variant="secondary">Paused</Badge>
			{/if}
		</Card.Title>
		{#if provider.account}
			<Card.Description>
				Connected as {provider.account.username ?? 'unknown'} · updated {timeAgo(
					provider.account.updatedAt
				)}
			</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if provider.notice}
			<Alert.Root>
				<WarningIcon />
				<Alert.Title>Before you start</Alert.Title>
				<Alert.Description>{provider.notice}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if provider.account}
			<div class="flex items-center justify-between gap-4">
				<div class="text-sm">
					<p class="font-medium">Scrobble and sync watch state</p>
					<p class="text-muted-foreground">Only one provider can be active.</p>
				</div>
				<ToggleForm
					action="?/activate"
					id={provider.id}
					checked={provider.account.active}
					label="Use {provider.name}"
				/>
			</div>
			{#if provider.account.lastError}
				<p class="text-sm text-destructive">Last error: {provider.account.lastError}</p>
			{/if}
		{:else if provider.device}
			<div class="space-y-2 rounded-md border p-4 text-sm">
				<p>
					Open <a
						class="underline underline-offset-4"
						href={provider.device.verificationUrl}
						target="_blank"
						rel="external noreferrer">{provider.device.verificationUrl}</a
					> and enter this code:
				</p>
				<p class="font-mono text-2xl tracking-widest">{provider.device.userCode}</p>
				<p class="text-muted-foreground">Waiting for approval. This page updates by itself.</p>
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
			<form method="POST" action="?/cancel" use:enhance>
				<input type="hidden" name="provider" value={provider.id} />
				<Button type="submit" variant="ghost" size="sm">Cancel</Button>
			</form>
		{:else}
			<form method="POST" action="?/credentials" use:formEnhance class="space-y-3">
				<input type="hidden" name="provider" value={provider.id} />
				<p class="text-sm text-muted-foreground">
					Create an API app at <a
						class="underline underline-offset-4"
						href={provider.credentialsUrl}
						target="_blank"
						rel="external noreferrer">{new URL(provider.credentialsUrl).host}</a
					>
					with redirect URI <code class="font-mono">urn:ietf:wg:oauth:2.0:oob</code>, then paste its
					credentials.
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
									placeholder={provider.clientId ? 'Saved' : ''}
									class="font-mono"
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>
				<Form.Button variant="outline" disabled={$submitting}>Save credentials</Form.Button>
			</form>
		{/if}
	</Card.Content>
	{#if !provider.device && (provider.account || provider.clientId)}
		<Card.Footer class="gap-2">
			{#if provider.account}
				<form
					method="POST"
					action="?/disconnect"
					use:enhance={({ cancel }) => {
						if (!confirm(`Disconnect ${provider.name}?`)) cancel();
					}}
				>
					<input type="hidden" name="provider" value={provider.id} />
					<Button type="submit" variant="destructive">Disconnect</Button>
				</form>
			{:else if provider.clientId}
				<form method="POST" action="?/connect" use:enhance={reportFailure}>
					<input type="hidden" name="provider" value={provider.id} />
					<Button type="submit">Connect {provider.name}</Button>
				</form>
			{/if}
		</Card.Footer>
	{/if}
</Card.Root>
