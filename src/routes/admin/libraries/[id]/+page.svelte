<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import Poster from '#lib/components/poster.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { reportFailure } from '#lib/forms.js';
	import { shift } from '#lib/reorder.js';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import CollectionItem from './collection-item.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let items = $derived(data.items);
	let reorderForm = $state<ReorderForm>();
	let removeForm = $state<HTMLFormElement>();
	let deleteForm = $state<HTMLFormElement>();
	let removing = $state('');
	let renameOpen = $state(false);
	let confirmDelete = $state(false);
	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Movies and series' } as const;

	/** Enhanced forms navigate to their action URL, so it carries the search to keep the results open. */
	function searchAction(name: string) {
		return data.query ? `?/${name}&q=${encodeURIComponent(data.query)}` : `?/${name}`;
	}

	function save(next: typeof items) {
		if (next === items) return;
		items = next;
		reorderForm?.submit(next.map((item) => item.stremioId));
	}

	async function remove(stremioId: string) {
		removing = stremioId;
		await tick();
		removeForm?.requestSubmit();
	}
</script>

<svelte:head><title>{data.library.name} · Lisbonera</title></svelte:head>

<a
	href={resolve('/admin/libraries')}
	class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeftIcon class="size-3.5" /> Libraries
</a>

<PageHeader
	title={data.library.name}
	meta="{items.length} {items.length === 1 ? 'title' : 'titles'} · {typeLabel[data.library.type]}"
>
	{#snippet actions()}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" size="icon" aria-label="Collection actions">
						<DotsThreeIcon weight="bold" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onSelect={() => (renameOpen = true)}>Rename</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}
					>Delete collection</DropdownMenu.Item
				>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/snippet}
</PageHeader>

<form
	method="GET"
	data-sveltekit-keepfocus
	data-sveltekit-noscroll
	class="mb-8 flex max-w-xl gap-2"
	role="search"
>
	<Input
		name="q"
		value={data.query}
		placeholder="Search addons for titles to add"
		autocomplete="off"
		aria-label="Search addons"
	/>
	<Button type="submit" variant="secondary">Search</Button>
	{#if data.query}
		<Button href={resolve('/admin/libraries/[id]', { id: data.library.id })} variant="ghost"
			>Clear</Button
		>
	{/if}
</form>

{#if data.query}
	<section aria-labelledby="results" class="mb-12">
		<h2 id="results" class="mb-3 text-[13px] font-medium text-muted-foreground">
			Results for “{data.query}”
		</h2>
		{#if data.results.length}
			<ul class="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
				{#each data.results as result (result.id)}
					<li class="group relative">
						<Poster
							src={result.poster}
							title={result.name}
							class={result.added ? 'opacity-40' : ''}
						/>
						<p class="mt-2 truncate text-xs" title={result.name}>
							{result.name} <span class="text-muted-foreground">{result.year}</span>
						</p>
						{#if result.added}
							<span
								class="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
								aria-label="In collection"
							>
								<CheckIcon class="size-4" weight="bold" />
							</span>
						{:else}
							<form
								method="POST"
								action={searchAction('add')}
								use:enhance={reportFailure}
								class="absolute top-1.5 right-1.5"
							>
								<input type="hidden" name="stremioId" value={result.id} />
								<input type="hidden" name="type" value={result.type} />
								<input type="hidden" name="name" value={result.name} />
								<input type="hidden" name="poster" value={result.poster ?? ''} />
								<button
									type="submit"
									class="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:size-9 [@media(hover:none)]:opacity-100"
									aria-label="Add {result.name}"
								>
									<PlusIcon class="size-4" weight="bold" />
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">
				Nothing found. Search needs an addon with a searchable catalog.
			</p>
		{/if}
	</section>
{/if}

<section aria-labelledby="titles">
	<h2 id="titles" class="mb-3 text-[13px] font-medium text-muted-foreground">In this collection</h2>
	{#if items.length}
		<DragDropProvider
			onDragEnd={(event) => {
				const next = reorderAfterDrag(items, event);
				if (next) save(next);
			}}
		>
			<ol class="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
				{#each items as item, index (item.stremioId)}
					<CollectionItem
						{item}
						{index}
						count={items.length}
						onMove={(delta) => save(shift(items, index, delta))}
						onRemove={() => remove(item.stremioId)}
					/>
				{/each}
			</ol>
		</DragDropProvider>
	{:else}
		<p class="border-y py-6 text-sm text-muted-foreground">Empty. Search above to add titles.</p>
	{/if}
</section>

<ReorderForm bind:this={reorderForm} action={searchAction('reorder')} />
<form
	method="POST"
	action={searchAction('remove')}
	use:enhance={reportFailure}
	bind:this={removeForm}
	class="hidden"
>
	<input type="hidden" name="stremioId" value={removing} />
</form>
<form method="POST" action="?/delete" use:enhance bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete {data.library.name}?"
	description="The collection and its title list are deleted. Apps stop showing it."
	confirmLabel="Delete collection"
	onConfirm={() => deleteForm?.requestSubmit()}
/>

<Dialog.Root bind:open={renameOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename collection</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action={searchAction('rename')}
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') renameOpen = false;
					await update();
				}}
			class="space-y-4"
		>
			<div class="space-y-2">
				<Label for="collection-name">Name</Label>
				<Input id="collection-name" name="name" value={data.library.name} maxlength={80} required />
			</div>
			<Dialog.Footer>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
