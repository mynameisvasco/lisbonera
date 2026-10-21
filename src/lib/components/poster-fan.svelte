<script lang="ts">
	import Poster from './poster.svelte';

	let {
		posters,
		muted = false
	}: { posters: { id: string; name: string; poster: string | null }[]; muted?: boolean } = $props();

	const slots = [
		'-translate-x-[70%] -rotate-[9deg] scale-90',
		'z-10 -translate-y-1',
		'translate-x-[70%] rotate-[9deg] scale-90'
	];
</script>

<div
	class={[
		'relative flex h-44 items-end justify-center overflow-hidden bg-gradient-to-b from-muted/60 to-transparent pt-6 transition',
		muted && 'opacity-50 grayscale'
	]}
>
	{#each posters.slice(0, 3) as item, index (item.id)}
		<div
			class={[
				'absolute top-6 w-24 transition-transform duration-300 group-hover:-translate-y-1.5',
				slots[posters.length === 1 ? 1 : index]
			]}
		>
			<Poster src={item.poster} title={item.name} class="shadow-xl ring-black/10" />
		</div>
	{:else}
		<div class="absolute top-6 w-24"><Poster src={null} title="" /></div>
	{/each}
</div>
