<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import CopyButton from '#lib/components/copy-button.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { appPasswordSchema } from '#lib/schemas.js';
	import { timeAgo } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let created = $state<{ label: string; password: string } | null>(null);

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(appPasswordSchema),
			resetForm: true,
			onResult: ({ result }) => {
				if (result.type === 'success' && result.data?.created) created = result.data.created;
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;
</script>

<svelte:head><title>Devices · Lisbonera</title></svelte:head>

<PageHeader
	title="Devices"
	description="Jellyfin clients sign in with your username and an app password. Create one per device so you can revoke it on its own."
/>

<form method="POST" action="?/create" use:formEnhance class="mb-6 flex items-start gap-2">
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
	<Form.Button disabled={$submitting}>Create app password</Form.Button>
</form>

<h2 class="mb-3 text-sm font-medium">App passwords</h2>
<Table.Root class="mb-8">
	<Table.Header>
		<Table.Row>
			<Table.Head>Name</Table.Head>
			<Table.Head>Created</Table.Head>
			<Table.Head>Last sign-in</Table.Head>
			<Table.Head class="w-24"><span class="sr-only">Actions</span></Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each data.passwords as password (password.id)}
			<Table.Row>
				<Table.Cell class="font-medium">{password.label}</Table.Cell>
				<Table.Cell class="text-muted-foreground">{timeAgo(password.createdAt)}</Table.Cell>
				<Table.Cell class="text-muted-foreground">{timeAgo(password.lastUsedAt)}</Table.Cell>
				<Table.Cell class="text-right">
					<form
						method="POST"
						action="?/revoke"
						use:enhance={({ cancel }) => {
							if (!confirm(`Revoke ${password.label}? Devices using it are signed out.`)) cancel();
						}}
					>
						<input type="hidden" name="id" value={password.id} />
						<Button type="submit" variant="destructive" size="sm">Revoke</Button>
					</form>
				</Table.Cell>
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground"
					>No app passwords.</Table.Cell
				>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>

<h2 class="mb-3 text-sm font-medium">Signed-in clients</h2>
<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Client</Table.Head>
			<Table.Head>Password</Table.Head>
			<Table.Head>Last seen</Table.Head>
			<Table.Head class="w-24"><span class="sr-only">Actions</span></Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each data.sessions as session (session.tokenHash)}
			<Table.Row>
				<Table.Cell>
					<div class="font-medium">{session.client} {session.version}</div>
					<div class="text-xs text-muted-foreground">{session.device}</div>
				</Table.Cell>
				<Table.Cell class="text-muted-foreground">{session.label}</Table.Cell>
				<Table.Cell class="text-muted-foreground">{timeAgo(session.lastSeenAt)}</Table.Cell>
				<Table.Cell class="text-right">
					<form method="POST" action="?/signOut" use:enhance>
						<input type="hidden" name="tokenHash" value={session.tokenHash} />
						<Button type="submit" variant="ghost" size="sm">Sign out</Button>
					</form>
				</Table.Cell>
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground"
					>No clients signed in.</Table.Cell
				>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>

<Dialog.Root open={created !== null} onOpenChange={(open) => !open && (created = null)}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>App password for {created?.label}</Dialog.Title>
			<Dialog.Description
				>It is shown only once. Dashes and letter case are ignored when you type it.</Dialog.Description
			>
		</Dialog.Header>
		<div class="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2">
			<code class="font-mono text-base tracking-wide">{created?.password}</code>
			<CopyButton value={created?.password ?? ''} label="Copy password" />
		</div>
		<Dialog.Footer>
			<Button onclick={() => (created = null)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
