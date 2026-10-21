<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import DragHandle from '#lib/components/drag-handle.svelte';
	import Poster from '#lib/components/poster.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';

	interface Library {
		id: string;
		name: string;
		kind: 'catalog' | 'collection';
		type: 'movie' | 'series' | 'mixed';
		source: string;
		enabled: boolean;
		posters: { id: string; name: string; poster: string | null }[];
	}

	let {
		library,
		index,
		count,
		onRename,
		onMove
	}: {
		library: Library;
		index: number;
		count: number;
		onRename: (library: Library) => void;
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

	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Mixed' } as const;
	let confirmDelete = $state(false);
	let deleteForm = $state<HTMLFormElement>();
</script>

<li
	{@attach sortable.attach}
	class={[
		'flex items-center gap-3 bg-background py-3 sm:gap-4',
		sortable.isDragging && 'relative z-20 rounded-md shadow-lg ring-1 ring-border'
	]}
>
	<DragHandle attach={sortable.attachHandle} label="Drag to reorder {library.name}" />

	<div class={['hidden shrink-0 gap-1 sm:flex', !library.enabled && 'opacity-40 grayscale']}>
		{#each library.posters.slice(0, 4) as item (item.id)}
			<Poster src={item.poster} title="" class="w-10 rounded-sm" />
		{:else}
			<div class="aspect-[2/3] w-10 rounded-sm bg-muted"></div>
		{/each}
	</div>

	<div class="min-w-0 flex-1">
		{#if library.kind === 'collection'}
			<a
				href={resolve('/admin/libraries/[id]', { id: library.id })}
				class="block truncate text-sm font-medium underline-offset-4 hover:underline"
				>{library.name}</a
			>
		{:else}
			<p class="truncate text-sm font-medium">{library.name}</p>
		{/if}
		<p class="truncate text-xs text-muted-foreground">
			{library.source} · {typeLabel[library.type]}{library.enabled ? '' : ' · Hidden'}
		</p>
	</div>

	<ToggleForm
		action="?/toggle"
		id={library.id}
		checked={library.enabled}
		label="Show {library.name}"
	/>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label="Actions for {library.name}">
					<DotsThreeIcon weight="bold" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onSelect={() => onRename(library)}>Rename</DropdownMenu.Item>
			{#if library.kind === 'collection'}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a href={resolve('/admin/libraries/[id]', { id: library.id })} {...props}>Edit titles</a
						>
					{/snippet}
				</DropdownMenu.Item>
			{/if}
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
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if library.kind === 'collection'}
		<form method="POST" action="?/remove" use:enhance bind:this={deleteForm} class="hidden">
			<input type="hidden" name="id" value={library.id} />
		</form>
		<ConfirmDialog
			bind:open={confirmDelete}
			title="Delete {library.name}?"
			description="The collection and its title list are deleted. Apps stop showing it."
			confirmLabel="Delete collection"
			onConfirm={() => deleteForm?.requestSubmit()}
		/>
	{/if}
</li>
