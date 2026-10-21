<script lang="ts">
	import PageHeader from '#lib/components/page-header.svelte';
	import ProviderPanel from './provider-panel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Trakt · Lisbonera</title></svelte:head>

<div class="mx-auto max-w-4xl">
	<PageHeader
		title="Scrobbling"
		meta="Progress, watched state, Continue Watching and Next Up come from the connected service."
	/>
	<div class="space-y-14">
		{#each data.providers as provider (provider.id)}
			<ProviderPanel {provider} />
		{/each}
	</div>
</div>
