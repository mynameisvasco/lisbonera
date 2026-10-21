<script lang="ts">
	import { resolve } from '$app/paths';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import Rows from '#lib/components/rows.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { plural } from '#lib/format.js';
	import { shift } from '#lib/reorder.js';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import ImagesSquareIcon from 'phosphor-svelte/lib/ImagesSquare';
	import LibraryRow from './library-row.svelte';
	import NewCollection from './new-collection.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let libraries = $derived(data.libraries);
	let reorderForm = $state<ReorderForm>();
	let createOpen = $state(false);
	const shown = $derived(libraries.filter((library) => library.enabled).length);

	function save(next: typeof libraries) {
		if (next === libraries) return;
		libraries = next;
		reorderForm?.submit(next.map((library) => library.id));
	}
</script>

<svelte:head><title>Libraries · Lisbonera</title></svelte:head>

<PageHeader
	title="Libraries"
	meta="{plural(shown, 'library', 'libraries')} shown in Jellyfin apps, in this order."
>
	{#snippet actions()}
		<Button href={resolve('/admin/libraries/packs')} variant="outline">
			<ImagesSquareIcon /> Packs
		</Button>
		<Button onclick={() => (createOpen = true)}><PlusIcon /> New collection</Button>
	{/snippet}
</PageHeader>

{#if libraries.length}
	<DragDropProvider
		onDragEnd={(event) => {
			const next = reorderAfterDrag(libraries, event);
			if (next) save(next);
		}}
	>
		<Rows ordered>
			{#each libraries as library, index (library.id)}
				<LibraryRow
					{library}
					{index}
					count={libraries.length}
					onMove={(delta) => save(shift(libraries, index, delta))}
				/>
			{/each}
		</Rows>
	</DragDropProvider>
{:else}
	<EmptyState>
		No libraries yet. Install an addon with catalogs, or create a collection.
		{#snippet action()}
			<Button variant="outline" size="sm" onclick={() => (createOpen = true)}>New collection</Button
			>
		{/snippet}
	</EmptyState>
{/if}

<ReorderForm bind:this={reorderForm} />

<NewCollection
	bind:open={createOpen}
	createForm={data.createForm}
	genresForm={data.genresForm}
	listForm={data.listForm}
	keyForm={data.keyForm}
	genreCatalogs={data.genreCatalogs}
	hasMdblistKey={data.hasMdblistKey}
	hasTraktApp={data.hasTraktApp}
/>
