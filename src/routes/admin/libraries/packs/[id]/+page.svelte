<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Notice from '#lib/components/notice.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import Poster from '#lib/components/poster.svelte';
	import Section from '#lib/components/section.svelte';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { plural, TYPE_LABEL } from '#lib/format.js';
	import { PACK_HOME } from '#lib/packs.js';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = $derived(
		data.listing
			? `${data.listing.category.charAt(0).toUpperCase()}${data.listing.category.slice(1)} by ${data.listing.author}`
			: 'Pack'
	);
	const hasLists = $derived(data.items.some((item) => item.lists.length > 0));

	type Mode = 'lists' | 'genre' | 'none';
	// svelte-ignore state_referenced_locally
	let mode = $state<Mode>(hasLists ? 'lists' : data.catalogs.length ? 'genre' : 'none');
	// svelte-ignore state_referenced_locally
	let catalog = $state(data.catalogs[0]?.key ?? '');
	// svelte-ignore state_referenced_locally
	let selected = $state<number[]>(data.items.map((item) => item.index));
	let importing = $state(false);

	const selectedCatalog = $derived(data.catalogs.find((item) => item.key === catalog));

	/** Mirrors the server's plan so each tile says what importing it will do. */
	function outcome(item: (typeof data.items)[number]): { label: string; ok: boolean } {
		if (item.existing) return { label: `Restyles ${item.existing}`, ok: true };
		if (mode === 'lists')
			return item.lists.length
				? { label: plural(item.lists.length, 'Trakt list'), ok: true }
				: { label: 'No lists', ok: false };
		if (mode === 'genre') {
			const genre = item.genres[catalog];
			return genre
				? { label: `Genre · ${genre}`, ok: true }
				: { label: 'No matching genre', ok: false };
		}
		return { label: 'Artwork only', ok: true };
	}

	const actionable = $derived(
		data.items.filter((item) => selected.includes(item.index) && outcome(item).ok).length
	);
	const action = $derived(
		data.listing ? '?/import' : `?/import&url=${encodeURIComponent(data.url)}`
	);
	const modes = $derived(
		[
			hasLists && { value: 'lists', label: 'Trakt lists' },
			data.catalogs.length > 0 && { value: 'genre', label: 'Addon genres' },
			{ value: 'none', label: 'Artwork only' }
		].filter((item): item is { value: Mode; label: string } => Boolean(item))
	);
</script>

<svelte:head><title>{title} · Lisbonera</title></svelte:head>

<PageHeader {title} back={{ href: resolve('/admin/libraries/packs'), label: 'Packs' }}>
	{#snippet meta()}
		<p>
			{plural(data.items.length, 'collection')} · artwork from the
			<a
				href={PACK_HOME}
				target="_blank"
				rel="external noreferrer"
				class="text-primary underline-offset-4 hover:underline">Fusion Starter Kit</a
			>, credit to its creators
		</p>
	{/snippet}
</PageHeader>

<form
	method="POST"
	{action}
	use:enhance={() => {
		importing = true;
		return async ({ result, update }) => {
			importing = false;
			if (result.type === 'success' && result.data) {
				const { created, restyled, skipped } = result.data as {
					created: number;
					restyled: number;
					skipped: string[];
				};
				const parts = [
					created && `created ${plural(created, 'collection')}`,
					restyled && `restyled ${plural(restyled, 'library', 'libraries')}`,
					skipped.length && `skipped ${skipped.length}`
				].filter(Boolean);
				toast.success(parts.length ? `Done: ${parts.join(', ')}` : 'Nothing to import');
				await goto(resolve('/admin/libraries'));
				return;
			}
			if (result.type === 'failure' && typeof result.data?.error === 'string')
				toast.error(result.data.error);
			await update({ reset: false });
		};
	}}
>
	<input type="hidden" name="mode" value={mode} />
	<input type="hidden" name="catalog" value={catalog} />
	{#each selected as index (index)}
		<input type="hidden" name="items" value={index} />
	{/each}

	<Section
		id="titles-from"
		title="Titles from"
		description="Libraries with the same name only get the new artwork; nothing else about them changes."
	>
		<div class="flex flex-wrap items-center gap-3">
			<ToggleGroup.Root
				type="single"
				variant="outline"
				value={mode}
				onValueChange={(value) => value && (mode = value as Mode)}
				aria-label="Titles from"
			>
				{#each modes as item (item.value)}
					<ToggleGroup.Item value={item.value} class="px-3">{item.label}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>

			{#if mode === 'genre'}
				<Select.Root type="single" bind:value={catalog}>
					<Select.Trigger class="min-w-56" aria-label="Catalog">
						{selectedCatalog
							? `${selectedCatalog.addonName} · ${selectedCatalog.name} (${TYPE_LABEL[selectedCatalog.type]})`
							: 'Choose a catalog'}
					</Select.Trigger>
					<Select.Content>
						{#each data.catalogs as item (item.key)}
							<Select.Item value={item.key}>
								{item.addonName} · {item.name}
								<span class="text-muted-foreground">{TYPE_LABEL[item.type]}</span>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
		{#if mode === 'lists' && !data.hasTraktApp}
			<Notice tone="warning" class="mt-4">
				Trakt lists are read with your Trakt API app.
				<a
					href={resolve('/admin/scrobbling')}
					class="text-primary underline-offset-4 hover:underline">Add one under Scrobbling</a
				> first.
			</Notice>
		{:else if mode === 'none'}
			<p class="mt-3 text-sm text-muted-foreground">
				New collections start empty; add titles to them by hand.
			</p>
		{/if}
	</Section>

	<Section id="pack-items" title="Collections">
		{#snippet actions()}
			<Button
				variant="ghost"
				size="sm"
				onclick={() =>
					(selected =
						selected.length === data.items.length ? [] : data.items.map((item) => item.index))}
			>
				{selected.length === data.items.length ? 'Select none' : 'Select all'}
			</Button>
		{/snippet}

		<ul
			class={[
				'grid gap-x-4 gap-y-5',
				data.items[0]?.shape === 'wide'
					? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
					: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-6'
			]}
		>
			{#each data.items as item (item.index)}
				{@const on = selected.includes(item.index)}
				{@const result = outcome(item)}
				<li>
					<button
						type="button"
						class="group block w-full rounded-md text-left"
						aria-pressed={on}
						onclick={() =>
							(selected = on
								? selected.filter((index) => index !== item.index)
								: [...selected, item.index])}
					>
						<Poster
							src={item.image}
							title={item.name}
							shape={item.shape}
							class={on ? 'transition' : 'opacity-40 grayscale transition'}
						>
							{#if on}
								<span
									class="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
								>
									<CheckIcon class="size-3.5" weight="bold" />
								</span>
							{/if}
						</Poster>
						<p class="mt-2 truncate text-xs font-medium">{item.name}</p>
						<p
							class={['truncate text-xs', result.ok ? 'text-muted-foreground' : 'text-terracotta']}
						>
							{result.label}
						</p>
					</button>
				</li>
			{/each}
		</ul>
	</Section>

	<div
		class="sticky bottom-16 z-30 -mx-4 flex items-center justify-between gap-4 border-t bg-background/80 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-4 md:bottom-4"
	>
		<p class="text-sm text-muted-foreground">
			{plural(actionable, 'collection')} will be added or restyled
		</p>
		<SubmitButton
			pending={importing}
			disabled={actionable === 0 || (mode === 'lists' && !data.hasTraktApp)}
		>
			Import
		</SubmitButton>
	</div>
</form>
