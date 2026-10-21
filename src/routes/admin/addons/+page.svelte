<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import PageHeader from '#lib/components/page-header.svelte';
	import RowActions from '#lib/components/row-actions.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwise';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import { addonSchema } from '#lib/schemas.js';
	import { reportFailure } from '#lib/forms.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(addonSchema),
			onUpdated: ({ form }) => {
				if (!form.message) return;
				if (form.valid) toast.success(form.message);
				else toast.error(form.message);
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;
</script>

<svelte:head><title>Addons · Lisbonera</title></svelte:head>

<PageHeader
	title="Addons"
	description="Stremio addons provide catalogs, metadata and streams. Addons higher in the list are asked first."
/>

<form method="POST" action="?/add" use:formEnhance class="mb-6 flex items-start gap-2">
	<Form.Field {form} name="url" class="flex-1">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label class="sr-only">Manifest URL</Form.Label>
				<Input
					{...props}
					bind:value={$formData.url}
					placeholder="https://…/manifest.json"
					autocomplete="off"
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Button disabled={$submitting}>Add addon</Form.Button>
</form>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Addon</Table.Head>
			<Table.Head>Provides</Table.Head>
			<Table.Head class="w-16">On</Table.Head>
			<Table.Head class="w-40 text-right"><span class="sr-only">Actions</span></Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each data.addons as addon, index (addon.id)}
			<Table.Row>
				<Table.Cell class="max-w-72">
					<div class="font-medium">{addon.name}</div>
					<div class="truncate font-mono text-xs text-muted-foreground" title={addon.url}>
						{addon.host}
					</div>
					{#if addon.lastError}
						<div class="mt-1 text-xs text-destructive">{addon.lastError}</div>
					{/if}
				</Table.Cell>
				<Table.Cell>
					<div class="flex flex-wrap gap-1">
						{#each addon.resources as resource (resource)}
							<Badge variant="secondary">{resource}</Badge>
						{/each}
					</div>
				</Table.Cell>
				<Table.Cell>
					<ToggleForm
						action="?/toggle"
						id={addon.id}
						checked={addon.enabled}
						label="Enable {addon.name}"
					/>
				</Table.Cell>
				<Table.Cell>
					<div class="flex justify-end">
						<RowActions id={addon.id} first={index === 0} last={index === data.addons.length - 1} />
						<form method="POST" action="?/refresh" use:enhance={reportFailure}>
							<input type="hidden" name="id" value={addon.id} />
							<Button type="submit" variant="ghost" size="icon-sm" aria-label="Reload manifest"
								><ArrowClockwiseIcon /></Button
							>
						</form>
						<form
							method="POST"
							action="?/remove"
							use:enhance={({ cancel }) => {
								if (!confirm(`Remove ${addon.name}? Its libraries are removed too.`)) cancel();
							}}
						>
							<input type="hidden" name="id" value={addon.id} />
							<Button type="submit" variant="ghost" size="icon-sm" aria-label="Remove addon"
								><TrashIcon /></Button
							>
						</form>
					</div>
				</Table.Cell>
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground"
					>No addons yet.</Table.Cell
				>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
