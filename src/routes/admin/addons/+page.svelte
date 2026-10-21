<script lang="ts">
	import { untrack } from 'svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import PageHeader from '#lib/components/page-header.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import LinkIcon from 'phosphor-svelte/lib/Link';
	import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
	import PlayIcon from 'phosphor-svelte/lib/Play';
	import { addonSchema } from '#lib/schemas.js';
	import AddonRow from './addon-row.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let addons = $derived(data.addons);
	let reorderForm = $state<ReorderForm>();

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
	description="Stremio addons supply catalogs, metadata and streams. Higher addons answer metadata first and list their streams first."
/>

<form method="POST" action="?/add" use:formEnhance class="mb-8">
	<Form.Field {form} name="url">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label class="sr-only">Manifest URL</Form.Label>
				<InputGroup.Root class="h-12 rounded-full bg-card pl-1.5">
					<InputGroup.Addon><LinkIcon class="size-4" /></InputGroup.Addon>
					<InputGroup.Input
						{...props}
						bind:value={$formData.url}
						placeholder="Paste a manifest URL, e.g. https://…/manifest.json"
						autocomplete="off"
						class="text-sm"
					/>
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button
							type="submit"
							variant="default"
							size="sm"
							class="rounded-full px-4"
							disabled={$submitting}
						>
							{#if $submitting}<Spinner />{/if} Install
						</InputGroup.Button>
					</InputGroup.Addon>
				</InputGroup.Root>
			{/snippet}
		</Form.Control>
		<Form.Description class="px-4 text-xs">
			Configure addons on their own page first (for example with your debrid key), then paste the
			resulting URL.
		</Form.Description>
		<Form.FieldErrors class="px-4" />
	</Form.Field>
</form>

{#if addons.length && !addons.some((addon) => addon.enabled && addon.resources.includes('stream'))}
	<div class="mb-4 flex items-start gap-3 rounded-2xl border border-tram/30 bg-tram/10 p-4 text-sm">
		<PlayIcon weight="fill" class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-tram" />
		<p>
			<span class="font-medium">No addon provides streams yet.</span>
			<span class="text-muted-foreground"
				>Clients can browse your libraries but have nothing to play.</span
			>
		</p>
	</div>
{/if}

{#if addons.length}
	<DragDropProvider
		onDragEnd={(event) => {
			const next = reorderAfterDrag(addons, event);
			if (!next) return;
			addons = next;
			reorderForm?.submit(addons.map((addon) => addon.id));
		}}
	>
		<div class="space-y-3">
			{#each addons as addon, index (addon.id)}
				<AddonRow {addon} {index} />
			{/each}
		</div>
	</DragDropProvider>
	<ReorderForm bind:this={reorderForm} />
{:else}
	<Empty.Root class="rounded-2xl border border-dashed">
		<Empty.Header>
			<Empty.Media variant="icon"><PuzzlePieceIcon /></Empty.Media>
			<Empty.Title>No addons</Empty.Title>
			<Empty.Description
				>Install a catalog addon such as Cinemeta and at least one stream addon.</Empty.Description
			>
		</Empty.Header>
	</Empty.Root>
{/if}
