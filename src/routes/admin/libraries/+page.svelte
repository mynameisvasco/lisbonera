<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import PageHeader from '#lib/components/page-header.svelte';
	import RowActions from '#lib/components/row-actions.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import { collectionSchema, renameSchema } from '#lib/schemas.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const typeLabels = { movie: 'Movies', series: 'Series', mixed: 'Mixed' } as const;

	let createOpen = $state(false);
	let renameOpen = $state(false);

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const create = superForm(
		untrack(() => data.createForm),
		{ validators: zod4Client(collectionSchema) }
	);
	const { form: createData, enhance: createEnhance, submitting: creating } = create;

	const rename = superForm(
		untrack(() => data.renameForm),
		{
			validators: zod4Client(renameSchema),
			onUpdated: ({ form }) => {
				if (form.valid) renameOpen = false;
			}
		}
	);
	const { form: renameData, enhance: renameEnhance, submitting: renaming } = rename;

	function startRename(library: { id: string; name: string }) {
		$renameData = { id: library.id, name: library.name };
		renameOpen = true;
	}
</script>

<svelte:head><title>Libraries · Lisbonera</title></svelte:head>

<PageHeader
	title="Libraries"
	description="Each enabled library appears in Jellyfin clients, in this order."
>
	{#snippet actions()}
		<Button variant="outline" onclick={() => (createOpen = true)}>New collection</Button>
	{/snippet}
</PageHeader>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Library</Table.Head>
			<Table.Head>Type</Table.Head>
			<Table.Head class="w-16">On</Table.Head>
			<Table.Head class="w-40 text-right"><span class="sr-only">Actions</span></Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each data.libraries as library, index (library.id)}
			<Table.Row>
				<Table.Cell>
					{#if library.kind === 'collection'}
						<a
							class="font-medium underline-offset-4 hover:underline"
							href={resolve('/admin/libraries/[id]', { id: library.id })}
						>
							{library.name}
						</a>
					{:else}
						<span class="font-medium">{library.name}</span>
					{/if}
					<div class="text-xs text-muted-foreground">{library.source}</div>
				</Table.Cell>
				<Table.Cell class="text-muted-foreground">{typeLabels[library.type]}</Table.Cell>
				<Table.Cell>
					<ToggleForm
						action="?/toggle"
						id={library.id}
						checked={library.enabled}
						label="Show {library.name}"
					/>
				</Table.Cell>
				<Table.Cell>
					<div class="flex justify-end">
						<RowActions
							id={library.id}
							first={index === 0}
							last={index === data.libraries.length - 1}
						/>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Rename"
							onclick={() => startRename(library)}
						>
							<PencilSimpleIcon />
						</Button>
						{#if library.kind === 'collection'}
							<form
								method="POST"
								action="?/remove"
								use:enhance={({ cancel }) => {
									if (!confirm(`Delete the collection ${library.name}?`)) cancel();
								}}
							>
								<input type="hidden" name="id" value={library.id} />
								<Button type="submit" variant="ghost" size="icon-sm" aria-label="Delete collection"
									><TrashIcon /></Button
								>
							</form>
						{/if}
					</div>
				</Table.Cell>
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground">
					No libraries. Add an addon with catalogs or create a collection.
				</Table.Cell>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New collection</Dialog.Title>
			<Dialog.Description>A library with titles you pick yourself.</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/create" use:createEnhance class="space-y-4">
			<Form.Field form={create} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$createData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field form={create} name="type">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Type</Form.Label>
						<Select.Root type="single" bind:value={$createData.type} name={props.name}>
							<Select.Trigger {...props} class="w-full"
								>{typeLabels[$createData.type]}</Select.Trigger
							>
							<Select.Content>
								<Select.Item value="movie" label="Movies" />
								<Select.Item value="series" label="Series" />
								<Select.Item value="mixed" label="Mixed" />
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
			</Form.Field>
			<Dialog.Footer>
				<Form.Button disabled={$creating}>Create</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={renameOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename library</Dialog.Title>
		</Dialog.Header>
		<form method="POST" action="?/rename" use:renameEnhance class="space-y-4">
			<input type="hidden" name="id" value={$renameData.id} />
			<Form.Field form={rename} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$renameData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Dialog.Footer>
				<Form.Button disabled={$renaming}>Save</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
