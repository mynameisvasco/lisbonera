<script lang="ts">
	import { untrack } from 'svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import PageHeader from '#lib/components/page-header.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
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

<div class="mx-auto max-w-4xl">
	<PageHeader
		title="Addons"
		meta="Higher addons answer metadata first and list their streams first."
	/>

	<form method="POST" action="?/add" use:formEnhance class="mb-10">
		<Form.Field {form} name="url">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Install from manifest URL</Form.Label>
					<div class="flex gap-2">
						<Input
							{...props}
							bind:value={$formData.url}
							placeholder="https://…/manifest.json"
							autocomplete="off"
							class="font-mono text-sm"
						/>
						<Form.Button disabled={$submitting}
							>{#if $submitting}<Spinner />{/if} Install</Form.Button
						>
					</div>
				{/snippet}
			</Form.Control>
			<Form.Description class="text-xs">
				Configure an addon on its own page first (for example with your debrid key) and paste the
				URL it gives you. Addons are listed at
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

	{#if addons.length && !hasStreams}
		<p class="mb-6 border-l-2 border-terracotta pl-3 text-sm">
			No enabled addon provides streams. Apps can browse but have nothing to play.
		</p>
	{/if}

	{#if addons.length}
		<DragDropProvider
			onDragEnd={(event) => {
				const next = reorderAfterDrag(addons, event);
				if (next) save(next);
			}}
		>
			<ol class="divide-y border-y">
				{#each addons as addon, index (addon.id)}
					<AddonRow
						{addon}
						{index}
						count={addons.length}
						onMove={(delta) => save(shift(addons, index, delta))}
					/>
				{/each}
			</ol>
		</DragDropProvider>
		<ReorderForm bind:this={reorderForm} />
	{:else}
		<p class="border-y py-6 text-sm text-muted-foreground">No addons installed.</p>
	{/if}
</div>
