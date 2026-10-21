<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import PosterFan from '#lib/components/poster-fan.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import ListPlusIcon from 'phosphor-svelte/lib/ListPlus';

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
		onRename
	}: { library: Library; index: number; onRename: (library: Library) => void } = $props();

	const sortable = createSortable({
		get id() {
			return library.id;
		},
		get index() {
			return index;
		}
	});

	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Mixed' } as const;
	let deleteForm = $state<HTMLFormElement>();
</script>

<article
	{@attach sortable.attach}
	class={[
		'group relative overflow-hidden rounded-2xl border border-border/70 bg-card transition-shadow',
		sortable.isDragging && 'z-20 shadow-2xl ring-2 ring-primary/50'
	]}
>
	<PosterFan posters={library.posters} muted={!library.enabled} />

	<div class="flex items-center gap-2 border-t border-border/60 p-3 pl-2">
		<button
			{@attach sortable.attachHandle}
			class="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
			aria-label="Drag to reorder {library.name}"
		>
			<DotsSixVerticalIcon class="size-4" weight="bold" />
		</button>
		<div class="min-w-0 flex-1">
			{#if library.kind === 'collection'}
				<a
					href={resolve('/admin/libraries/[id]', { id: library.id })}
					class="block truncate font-medium underline-offset-4 hover:underline">{library.name}</a
				>
			{:else}
				<p class="truncate font-medium">{library.name}</p>
			{/if}
			<p class="truncate text-xs text-muted-foreground">
				{library.source} · {typeLabel[library.type]}
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
					<Button {...props} variant="ghost" size="icon-sm" aria-label="More for {library.name}">
						<DotsThreeIcon weight="bold" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onSelect={() => onRename(library)}
					><PencilSimpleIcon /> Rename</DropdownMenu.Item
				>
				{#if library.kind === 'collection'}
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/admin/libraries/[id]', { id: library.id })} {...props}
								><ListPlusIcon /> Edit titles</a
							>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item
						variant="destructive"
						onSelect={() => {
							if (confirm(`Delete the collection ${library.name}?`)) deleteForm?.requestSubmit();
						}}
					>
						<TrashIcon /> Delete
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	{#if library.kind === 'collection'}
		<form method="POST" action="?/remove" use:enhance bind:this={deleteForm} class="hidden">
			<input type="hidden" name="id" value={library.id} />
		</form>
	{/if}
</article>
