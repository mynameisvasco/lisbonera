<script lang="ts">
	import { enhance } from '$app/forms';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import Poster from '#lib/components/poster.svelte';
	import XIcon from 'phosphor-svelte/lib/X';

	let {
		item,
		index,
		action
	}: {
		item: { stremioId: string; name: string; poster: string | null };
		index: number;
		action: string;
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

<figure
	{@attach sortable.attach}
	class={[
		'group relative cursor-grab touch-none active:cursor-grabbing',
		sortable.isDragging && 'z-20 scale-105'
	]}
>
	<form method="POST" {action} use:enhance class="absolute top-1.5 right-1.5 z-10">
		<input type="hidden" name="stremioId" value={item.stremioId} />
		<button
			type="submit"
			class="flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
			aria-label="Remove {item.name}"
		>
			<XIcon class="size-3.5" weight="bold" />
		</button>
	</form>
	<Poster
		src={item.poster}
		title={item.name}
		class={sortable.isDragging ? 'shadow-2xl ring-2 ring-primary' : ''}
	/>
	<figcaption class="mt-2 truncate text-xs text-muted-foreground">{item.name}</figcaption>
</figure>
