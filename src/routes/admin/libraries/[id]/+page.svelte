<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { reorderAfterDrag } from '#lib/sortable.js';
	import Poster from '#lib/components/poster.svelte';
	import ReorderForm from '#lib/components/reorder-form.svelte';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import CollectionItem from './collection-item.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let items = $derived(data.items);
	let reorderForm = $state<ReorderForm>();
	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Movies and series' } as const;

	/** Enhanced forms navigate to their action URL, so it carries the search to keep the results open. */
	function searchAction(name: string) {
		return data.query ? `?/${name}&q=${encodeURIComponent(data.query)}` : `?/${name}`;
	}
</script>

<svelte:head><title>{data.library.name} · Lisbonera</title></svelte:head>

<a
	href={resolve('/admin/libraries')}
	class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeftIcon class="size-3.5" /> Libraries
</a>

<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<p class="text-xs font-medium tracking-wide text-primary uppercase">
			Collection · {typeLabel[data.library.type]}
		</p>
		<h1 class="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{data.library.name}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{items.length}
			{items.length === 1 ? 'title' : 'titles'} · drag posters to reorder
		</p>
	</div>
</div>

<form method="GET" data-sveltekit-keepfocus data-sveltekit-noscroll class="mb-6">
	<InputGroup.Root class="h-12 rounded-full bg-card pl-1.5">
		<InputGroup.Addon><MagnifyingGlassIcon class="size-4" /></InputGroup.Addon>
		<InputGroup.Input
			name="q"
			value={data.query}
			placeholder="Search your addons to add titles"
			autocomplete="off"
			aria-label="Search"
		/>
		<InputGroup.Addon align="inline-end">
			<InputGroup.Button type="submit" variant="secondary" size="sm" class="rounded-full px-4"
				>Search</InputGroup.Button
			>
		</InputGroup.Addon>
	</InputGroup.Root>
</form>

{#if data.query}
	<section class="mb-10 rounded-[1.75rem] border border-border/70 bg-card p-5 sm:p-6">
		<h2 class="mb-4 text-sm font-medium">Results for “{data.query}”</h2>
		{#if data.results.length}
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
				{#each data.results as result (result.id)}
					<figure class="group relative">
						{#if result.added}
							<span
								class="absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								<CheckIcon class="size-3.5" weight="bold" />
							</span>
						{:else}
							<form
								method="POST"
								action={searchAction('add')}
								use:enhance
								class="absolute inset-x-0 top-0 z-10 aspect-[2/3]"
							>
								<input type="hidden" name="stremioId" value={result.id} />
								<input type="hidden" name="type" value={result.type} />
								<input type="hidden" name="name" value={result.name} />
								<input type="hidden" name="poster" value={result.poster ?? ''} />
								<button
									type="submit"
									class="flex size-full items-center justify-center rounded-xl bg-black/0 text-white transition-colors hover:bg-black/50 focus-visible:bg-black/50"
									aria-label="Add {result.name}"
								>
									<span
										class="flex size-10 scale-90 items-center justify-center rounded-full bg-primary opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"
									>
										<PlusIcon class="size-5" weight="bold" />
									</span>
								</button>
							</form>
						{/if}
						<Poster
							src={result.poster}
							title={result.name}
							class={result.added ? 'opacity-50' : ''}
						/>
						<figcaption class="mt-2 truncate text-xs">
							{result.name} <span class="text-muted-foreground">{result.year}</span>
						</figcaption>
					</figure>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				Nothing found. Search needs an addon with a searchable catalog.
			</p>
		{/if}
	</section>
{/if}

{#if items.length}
	<DragDropProvider
		onDragEnd={(event) => {
			const next = reorderAfterDrag(items, event);
			if (!next) return;
			items = next;
			reorderForm?.submit(items.map((item) => item.stremioId));
		}}
	>
		<div class="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
			{#each items as item, index (item.stremioId)}
				<CollectionItem {item} {index} action={searchAction('remove')} />
			{/each}
		</div>
	</DragDropProvider>
	<ReorderForm bind:this={reorderForm} action={searchAction('reorder')} />
{:else}
	<Empty.Root class="rounded-2xl border border-dashed">
		<Empty.Header>
			<Empty.Media variant="icon"><StackIcon /></Empty.Media>
			<Empty.Title>Empty collection</Empty.Title>
			<Empty.Description
				>Search above and add titles. They appear in your apps in this order.</Empty.Description
			>
		</Empty.Header>
	</Empty.Root>
{/if}
