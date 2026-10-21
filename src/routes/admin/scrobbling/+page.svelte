<script lang="ts">
	import PageHeader from '#lib/components/page-header.svelte';
	import ProviderPanel from './provider-panel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Scrobbling · Lisbonera</title></svelte:head>

<PageHeader
	title="Scrobbling"
	meta="Progress, watched state, Continue Watching and Next Up come from the connected service."
/>
{#each data.providers as provider (provider.id)}
	<ProviderPanel {provider} />
{/each}
