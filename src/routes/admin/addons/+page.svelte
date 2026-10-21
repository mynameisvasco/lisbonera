<script lang="ts">
	import { untrack } from 'svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Notice from '#lib/components/notice.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import Rows from '#lib/components/rows.svelte';
	import Section from '#lib/components/section.svelte';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { addonSchema } from '#lib/schemas.js';
	import { shift } from '#lib/reorder.js';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import AddonRow from './addon-row.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let addons = $derived(data.addons);
	let reorderForm = $state<ReorderForm>();
	const hasStreams = $derived(
		addons.some((addon) => addon.enabled && addon.resources.includes('stream'))
	);

	function save(next: typeof addons) {
		if (next === addons) return;
		addons = next;
		reorderForm?.submit(next.map((addon) => addon.id));
	}

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(addonSchema),
			onUpdated: ({ form }) => {
				if (!form.message) return;
				if (form.valid) toast.success(form.message);
				else toast.error(form.message);
			}
		}
	);
	const { form: formData, enhance: formEnhance, submitting } = form;
</script>

<svelte:head><title>Addons · Lisbonera</title></svelte:head>

<PageHeader
	title="Addons"
	meta="Higher addons answer metadata first and list their streams first."
/>

<Section id="install" title="Install">
	<form method="POST" action="?/add" use:formEnhance class="max-w-2xl">
		<Form.Field {form} name="url">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label class="sr-only">Manifest URL</Form.Label>
					<div class="flex gap-2">
						<Input
							{...props}
							bind:value={$formData.url}
							placeholder="https://…/manifest.json"
							autocomplete="off"
							class="font-mono text-sm"
						/>
						<SubmitButton pending={$submitting}>Install</SubmitButton>
					</div>
				{/snippet}
			</Form.Control>
			<Form.Description class="text-xs">
				Configure an addon on its own page first (for example with your debrid key) and paste the
				manifest URL it gives you. Browse addons at
				<a
					href="https://stremio-addons.net"
					target="_blank"
					rel="external noreferrer"
					class="text-primary underline-offset-4 hover:underline">stremio-addons.net</a
				>.
			</Form.Description>
			<Form.FieldErrors />
		</Form.Field>
	</form>
	<Notice class="mt-6">
		<p>
			For richer metadata, artwork and catalogs (TMDB, TVDB, MDBList, streaming services, genres),
			configure
			<a
				href="https://github.com/cedya77/aiometadata"
				target="_blank"
				rel="external noreferrer"
				class="text-primary underline-offset-4 hover:underline">AIOMetadata</a
			>, install it and drag it above Cinemeta.
		</p>
	</Notice>
</Section>

<Section id="installed" title="Installed">
	{#if addons.length && !hasStreams}
		<Notice tone="warning" class="mb-4">
			No enabled addon provides streams. Apps can browse but have nothing to play.
		</Notice>
	{/if}

	{#if addons.length}
		<DragDropProvider
			onDragEnd={(event) => {
				const next = reorderAfterDrag(addons, event);
				if (next) save(next);
			}}
		>
			<Rows ordered>
				{#each addons as addon, index (addon.id)}
					<AddonRow
						{addon}
						{index}
						count={addons.length}
						onMove={(delta) => save(shift(addons, index, delta))}
					/>
				{/each}
			</Rows>
		</DragDropProvider>
		<ReorderForm bind:this={reorderForm} />
	{:else}
		<EmptyState>No addons installed.</EmptyState>
	{/if}
</Section>
