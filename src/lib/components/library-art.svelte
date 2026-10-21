<script lang="ts">
	import Poster from './poster.svelte';

	let {
		library
	}: {
		library: {
			name: string;
			image: string | null;
			imageAspect: number | null;
			posters?: { id: string; poster: string | null }[];
		};
	} = $props();
</script>

<!-- A fixed 60px-high slot: the library's own artwork when it has one, otherwise its first posters. -->
<div class="flex h-15 items-center gap-1">
	{#if library.image}
		<Poster
			src={library.image}
			title={library.name}
			aspect={library.imageAspect ?? 16 / 9}
			class="h-full rounded-sm"
		/>
	{:else}
		{#each (library.posters ?? []).slice(0, 3) as item (item.id)}
			<Poster src={item.poster} title="" class="h-full rounded-sm" />
		{:else}
			<div class="aspect-[2/3] h-full rounded-sm bg-muted"></div>
		{/each}
	{/if}
</div>
