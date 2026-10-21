<script lang="ts">
	import PageHeader from '#lib/components/page-header.svelte';
	import ProviderCard from './provider-card.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Scrobbling · Lisbonera</title></svelte:head>

<PageHeader
	title="Scrobbling"
	description="Playback progress, watched state, Continue Watching and Next Up come from the active provider. Without one, nothing is tracked."
/>

<div class="space-y-4">
	{#each data.providers as provider (provider.id)}
		<ProviderCard {provider} />
	{/each}
</div>
