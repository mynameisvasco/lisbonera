<script lang="ts">
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import Poster from '#lib/components/poster.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';

	let {
		item,
		index,
		count,
		onMove,
		onRemove
	}: {
		item: { stremioId: string; name: string; poster: string | null };
		index: number;
		count: number;
		onMove: (delta: number) => void;
		onRemove: () => void;
	} = $props();

	const sortable = createSortable({
		get id() {
			return item.stremioId;
		},
		get index() {
			return index;
		}
	});
</script>

<li {@attach sortable.attach} class={['group relative', sortable.isDragging && 'z-20']}>
	<Poster
		src={item.poster}
		title={item.name}
		class={sortable.isDragging ? 'shadow-lg ring-2 ring-primary' : ''}
	/>
	<p class="mt-2 truncate text-xs text-muted-foreground" title={item.name}>{item.name}</p>

	<button
		type="button"
		{@attach sortable.attachHandle}
		class="absolute top-1.5 left-1.5 poster-control cursor-grab touch-none active:cursor-grabbing"
		aria-label="Drag to reorder {item.name}"
	>
		<DotsSixVerticalIcon class="size-4" weight="bold" />
	</button>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="absolute top-1.5 right-1.5 poster-control"
			aria-label="Actions for {item.name}"
		>
			<DotsThreeIcon class="size-4" weight="bold" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item disabled={index === 0} onSelect={() => onMove(-1)}
				>Move earlier</DropdownMenu.Item
			>
			<DropdownMenu.Item disabled={index === count - 1} onSelect={() => onMove(1)}
				>Move later</DropdownMenu.Item
			>
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onSelect={onRemove}
				>Remove from collection</DropdownMenu.Item
			>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</li>
