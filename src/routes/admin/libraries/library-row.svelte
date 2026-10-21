<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import DragHandle from '#lib/components/drag-handle.svelte';
	import LibraryArt from '#lib/components/library-art.svelte';
	import Row from '#lib/components/row.svelte';
	import RowMenu from '#lib/components/row-menu.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { TYPE_LABEL } from '#lib/format.js';

	interface Library {
		id: string;
		name: string;
		kind: 'catalog' | 'collection';
		type: 'movie' | 'series' | 'mixed';
		source: string;
		enabled: boolean;
		image: string | null;
		imageAspect: number | null;
		posters: { id: string; name: string; poster: string | null }[];
	}

	let {
		library,
		index,
		count,
		onMove
	}: {
		library: Library;
		index: number;
		count: number;
		onMove: (delta: number) => void;
	} = $props();

	const sortable = createSortable({
		get id() {
			return library.id;
		},
		get index() {
			return index;
		}
	});

	const href = $derived(resolve('/admin/libraries/[id]', { id: library.id }));
	let confirmDelete = $state(false);
	let deleteForm = $state<HTMLFormElement>();
</script>

<Row
	attach={sortable.attach}
	dragging={sortable.isDragging}
	title={library.name}
	{href}
	muted={!library.enabled}
	meta="{library.source} · {TYPE_LABEL[library.type]}{library.enabled ? '' : ' · Hidden'}"
>
	{#snippet leading()}
		<DragHandle attach={sortable.attachHandle} label="Drag to reorder {library.name}" />
	{/snippet}
	{#snippet media()}
		<LibraryArt {library} />
	{/snippet}
	{#snippet trailing()}
		<ToggleForm
			action="?/toggle"
			id={library.id}
			checked={library.enabled}
			label="Show {library.name}"
		/>
		<RowMenu label="Actions for {library.name}">
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {href} {...props}>Edit</a>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item disabled={index === 0} onSelect={() => onMove(-1)}
				>Move up</DropdownMenu.Item
			>
			<DropdownMenu.Item disabled={index === count - 1} onSelect={() => onMove(1)}
				>Move down</DropdownMenu.Item
			>
			{#if library.kind === 'collection'}
				<DropdownMenu.Separator />
				<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}
					>Delete</DropdownMenu.Item
				>
			{/if}
		</RowMenu>
	{/snippet}

	{#if library.kind === 'collection'}
		<form method="POST" action="?/remove" use:enhance bind:this={deleteForm} class="hidden">
			<input type="hidden" name="id" value={library.id} />
		</form>
		<ConfirmDialog
			bind:open={confirmDelete}
			title="Delete {library.name}?"
			description="The collection is deleted and apps stop showing it. Its sources are not affected."
			confirmLabel="Delete collection"
			onConfirm={() => deleteForm?.requestSubmit()}
		/>
	{/if}
</Row>
