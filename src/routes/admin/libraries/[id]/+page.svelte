<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import Poster from '#lib/components/poster.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import RowMenu from '#lib/components/row-menu.svelte';
	import Rows from '#lib/components/rows.svelte';
	import Section from '#lib/components/section.svelte';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { measureImage, prepareImage, saveArtwork } from '#lib/artwork.js';
	import { plural, TYPE_LABEL } from '#lib/format.js';
	import { reportFailure } from '#lib/forms.js';
	import { shift } from '#lib/reorder.js';
	import { renameSchema } from '#lib/schemas.js';
	import { shapeOf, SHAPE_LABEL } from '#lib/shapes.js';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import ImagesSquareIcon from 'phosphor-svelte/lib/ImagesSquare';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimple';
	import CollectionItem from './collection-item.svelte';
	import PackPicker from './pack-picker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const library = $derived(data.library);
	const manual = $derived(library.origin === 'manual');
	let items = $derived(data.items);
	let reorderForm = $state<ReorderForm>();
	let removeForm = $state<HTMLFormElement>();
	let deleteForm = $state<HTMLFormElement>();
	let fileInput = $state<HTMLInputElement>();
	let removing = $state('');
	let renameOpen = $state(false);
	let urlOpen = $state(false);
	let pickerOpen = $state(false);
	let confirmDelete = $state(false);
	let savingArt = $state(false);
	let imageUrl = $state('');

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

	const count = $derived(manual ? items.length : data.preview.length);
	const meta = $derived(
		[
			library.source,
			TYPE_LABEL[library.type],
			manual ? plural(count, 'title') : null,
			library.enabled ? null : 'Hidden'
		]
			.filter(Boolean)
			.join(' · ')
	);

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

	async function applyArtwork(fields: Parameters<typeof saveArtwork>[0]) {
		savingArt = true;
		const failure = await saveArtwork(fields).catch(() => 'Could not save the artwork');
		savingArt = false;
		if (failure) toast.error(failure);
		else toast.success('Artwork saved');
		return !failure;
	}

	async function upload(file: File | undefined) {
		if (!file) return;
		try {
			const { blob, aspect } = await prepareImage(file);
			await applyArtwork({ file: blob, aspect });
		} catch {
			toast.error('That file could not be read as an image');
		}
	}

	async function useUrl() {
		const url = imageUrl.trim();
		if (!url) return;
		if (await applyArtwork({ url, aspect: await measureImage(url) })) {
			urlOpen = false;
			imageUrl = '';
		}
	}
</script>

<svelte:head><title>{library.name} · Lisbonera</title></svelte:head>

<PageHeader
	title={library.name}
	{meta}
	back={{ href: resolve('/admin/libraries'), label: 'Libraries' }}
>
	{#snippet actions()}
		<span class="text-sm text-muted-foreground">Show in apps</span>
		<ToggleForm
			action="?/toggle"
			id={library.id}
			checked={library.enabled}
			label="Show {library.name} in apps"
		/>
		<RowMenu label="Library actions" variant="outline">
			<DropdownMenu.Item onSelect={() => (renameOpen = true)}>Rename</DropdownMenu.Item>
			{#if library.kind === 'collection'}
				<DropdownMenu.Separator />
				<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}
					>Delete collection</DropdownMenu.Item
				>
			{/if}
		</RowMenu>
	{/snippet}
</PageHeader>

<Section
	id="artwork"
	title="Artwork"
	description="The library’s tile in Jellyfin apps. Without one, apps show their default."
>
	<div class="flex flex-wrap items-end gap-6">
		<div class={library.image && shapeOf(library.imageAspect) === 'poster' ? 'w-36' : 'w-72'}>
			{#if library.image}
				<Poster src={library.image} title={library.name} aspect={library.imageAspect ?? 16 / 9} />
				<p class="mt-2 text-xs text-muted-foreground">
					{SHAPE_LABEL[shapeOf(library.imageAspect)]}
				</p>
			{:else}
				<div
					class="flex aspect-video items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
				>
					No artwork
				</div>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="secondary" onclick={() => (pickerOpen = true)} disabled={savingArt}>
				<ImagesSquareIcon /> Choose from packs
			</Button>
			<Button variant="outline" onclick={() => fileInput?.click()} disabled={savingArt}>
				<UploadSimpleIcon /> Upload
			</Button>
			<Button variant="outline" onclick={() => (urlOpen = true)} disabled={savingArt}
				>Image URL</Button
			>
			{#if library.image}
				<form method="POST" action={searchAction('clearArtwork')} use:enhance={reportFailure}>
					<Button type="submit" variant="ghost" class="text-destructive hover:text-destructive"
						>Remove</Button
					>
				</form>
			{/if}
		</div>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		class="hidden"
		onchange={(event) => {
			upload(event.currentTarget.files?.[0]);
			event.currentTarget.value = '';
		}}
	/>
</Section>

{#if library.sources.length}
	<Section
		id="sources"
		title="Sources"
		description="Titles follow these sources and update with them, one source after the other."
	>
		<Rows>
			{#each library.sources as source, index (index)}
				<li class="flex min-h-10 items-center gap-3 py-3 text-sm">
					<span class="min-w-0 flex-1 truncate">{source.label}</span>
					{#if source.href}
						<Button
							href={source.href}
							target="_blank"
							rel="external noreferrer"
							variant="ghost"
							size="icon-sm"
							aria-label="Open {source.label}"
						>
							<ArrowSquareOutIcon />
						</Button>
					{/if}
				</li>
			{/each}
		</Rows>
	</Section>
{/if}

{#if manual}
	<Section id="add-titles" title="Add titles">
		<form
			method="GET"
			data-sveltekit-keepfocus
			data-sveltekit-noscroll
			class="flex max-w-2xl gap-2"
			role="search"
		>
			<Input
				name="q"
				value={data.query}
				placeholder="Search your addons"
				autocomplete="off"
				aria-label="Search addons"
			/>
			<Button type="submit" variant="secondary">Search</Button>
			{#if data.query}
				<Button href={resolve('/admin/libraries/[id]', { id: library.id })} variant="ghost"
					>Clear</Button
				>
			{/if}
		</form>

		{#if data.query}
			<h3 class="mt-6 mb-3 text-sm text-muted-foreground">Results for “{data.query}”</h3>
			{#if data.results.length}
				<ul class="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
					{#each data.results as result (result.id)}
						<li class="group">
							<Poster
								src={result.poster}
								title={result.name}
								class={result.added ? 'opacity-40' : ''}
							>
								{#if result.added}
									<span
										class="absolute top-1.5 right-1.5 poster-control opacity-100"
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
										<button type="submit" class="poster-control" aria-label="Add {result.name}">
											<PlusIcon class="size-4" weight="bold" />
										</button>
									</form>
								{/if}
							</Poster>
							<p class="mt-2 truncate text-xs" title={result.name}>
								{result.name} <span class="text-muted-foreground">{result.year}</span>
							</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">
					Nothing found. Search needs an addon with a searchable catalog.
				</p>
			{/if}
		{/if}
	</Section>
{/if}

<Section id="titles" title={manual ? 'In this collection' : 'First titles'}>
	{#if manual && items.length}
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
	{:else if !manual && data.preview.length}
		<ul class="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
			{#each data.preview as item (item.id)}
				<li>
					<Poster src={item.poster} title={item.name} />
					<p class="mt-2 truncate text-xs text-muted-foreground" title={item.name}>{item.name}</p>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState>
			{manual
				? 'Empty. Search above to add titles.'
				: 'Nothing yet. The source returned no titles or is unreachable.'}
		</EmptyState>
	{/if}
</Section>

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
	title="Delete {library.name}?"
	description="The collection is deleted and apps stop showing it. Its sources are not affected."
	confirmLabel="Delete collection"
	onConfirm={() => deleteForm?.requestSubmit()}
/>

<PackPicker
	bind:open={pickerOpen}
	name={library.name}
	onPick={(image) => applyArtwork({ url: image.url, aspect: image.aspect })}
/>

<Dialog.Root bind:open={renameOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename library</Dialog.Title>
			<Dialog.Description
				>Jellyfin apps pick up the new name on their next refresh.</Dialog.Description
			>
		</Dialog.Header>
		<form method="POST" action={searchAction('rename')} use:renameEnhance class="space-y-5">
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
				<SubmitButton pending={$renaming}>Save</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={urlOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Use an image URL</Dialog.Title>
			<Dialog.Description>
				The image is fetched through this server and cached, so apps never load it directly.
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="space-y-5"
			onsubmit={(event) => {
				event.preventDefault();
				useUrl();
			}}
		>
			<Input
				bind:value={imageUrl}
				type="url"
				placeholder="https://…/artwork.png"
				class="font-mono text-sm"
				aria-label="Image URL"
				required
			/>
			<Dialog.Footer>
				<SubmitButton pending={savingArt}>Save</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
