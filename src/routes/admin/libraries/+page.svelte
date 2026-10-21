<script lang="ts">
	import { untrack } from 'svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import PageHeader from '#lib/components/page-header.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import FilmSlateIcon from 'phosphor-svelte/lib/FilmSlate';
	import TelevisionSimpleIcon from 'phosphor-svelte/lib/TelevisionSimple';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import { collectionSchema, renameSchema } from '#lib/schemas.js';
	import LibraryRow from './library-row.svelte';
	import { shift } from '#lib/reorder.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let libraries = $derived(data.libraries);
	let reorderForm = $state<ReorderForm>();

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

	function save(next: typeof libraries) {
		if (next === libraries) return;
		libraries = next;
		reorderForm?.submit(next.map((library) => library.id));
	}

	function startRename(library: { id: string; name: string }) {
		$renameData = { id: library.id, name: library.name };
		renameOpen = true;
	}

	const types = [
		{ value: 'movie', label: 'Movies', icon: FilmSlateIcon },
		{ value: 'series', label: 'Series', icon: TelevisionSimpleIcon },
		{ value: 'mixed', label: 'Mixed', icon: SquaresFourIcon }
	] as const;
</script>

<svelte:head><title>Libraries · Lisbonera</title></svelte:head>

<PageHeader title="Libraries" meta="Shown in this order in Jellyfin apps.">
	{#snippet actions()}
		<Button variant="outline" onclick={() => (createOpen = true)}
			><PlusIcon /> New collection</Button
		>
	{/snippet}
</PageHeader>

<DragDropProvider
	onDragEnd={(event) => {
		const next = reorderAfterDrag(libraries, event);
		if (next) save(next);
	}}
>
	<ol class="divide-y border-y">
		{#each libraries as library, index (library.id)}
			<LibraryRow
				{library}
				{index}
				count={libraries.length}
				onRename={startRename}
				onMove={(delta) => save(shift(libraries, index, delta))}
			/>
		{/each}
	</ol>
</DragDropProvider>
{#if libraries.length === 0}
	<p class="py-6 text-sm text-muted-foreground">
		No libraries. Install an addon with catalogs or create a collection.
	</p>
{/if}

<ReorderForm bind:this={reorderForm} />

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New collection</Dialog.Title>
			<Dialog.Description
				>Pick titles from your addons and show them as one library.</Dialog.Description
			>
		</Dialog.Header>
		<form method="POST" action="?/create" use:createEnhance class="space-y-5">
			<Form.Field form={create} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$createData.name} placeholder="Weekend picks" />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Fieldset form={create} name="type">
				<Form.Legend class="mb-2 text-sm font-medium">Contains</Form.Legend>
				<input type="hidden" name="type" value={$createData.type} />
				<ToggleGroup.Root
					type="single"
					variant="outline"
					class="w-full"
					value={$createData.type}
					onValueChange={(value) => value && ($createData.type = value as typeof $createData.type)}
				>
					{#each types as type (type.value)}
						<ToggleGroup.Item
							value={type.value}
							class="flex-1 gap-1.5 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
						>
							<type.icon />
							{type.label}
						</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			</Form.Fieldset>
			<Dialog.Footer>
				<Form.Button disabled={$creating}>Create and add titles</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={renameOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename library</Dialog.Title>
			<Dialog.Description
				>Jellyfin apps pick up the new name on their next refresh.</Dialog.Description
			>
		</Dialog.Header>
		<form method="POST" action="?/rename" use:renameEnhance class="space-y-5">
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
