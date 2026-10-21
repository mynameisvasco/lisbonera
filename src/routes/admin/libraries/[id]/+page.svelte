<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/components/page-header.svelte';
	import RowActions from '#lib/components/row-actions.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.library.name} · Lisbonera</title></svelte:head>

<a
	href={resolve('/admin/libraries')}
	class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeftIcon class="size-3.5" /> Libraries
</a>

<PageHeader title={data.library.name} description="{data.items.length} titles" />

{#snippet poster(url: string | null)}
	{#if url}
		<img
			src={url}
			alt=""
			loading="lazy"
			class="h-12 w-8 shrink-0 rounded-sm bg-muted object-cover"
		/>
	{:else}
		<div class="h-12 w-8 shrink-0 rounded-sm bg-muted"></div>
	{/if}
{/snippet}

<section class="mb-8">
	<form method="GET" class="mb-3 flex gap-2" data-sveltekit-keepfocus>
		<Input
			name="q"
			value={data.query}
			placeholder="Search addons"
			aria-label="Search addons"
			autocomplete="off"
		/>
		<Button type="submit" variant="outline">Search</Button>
	</form>

	{#if data.query}
		<Table.Root>
			<Table.Body>
				{#each data.results as result (result.id)}
					<Table.Row>
						<Table.Cell>
							<div class="flex items-center gap-3">
								{@render poster(result.poster)}
								<div>
									<div class="font-medium">{result.name}</div>
									<div class="text-xs text-muted-foreground">
										{result.year} · {result.type === 'movie' ? 'Movie' : 'Series'}
									</div>
								</div>
							</div>
						</Table.Cell>
						<Table.Cell class="w-28 text-right">
							{#if result.added}
								<span class="text-xs text-muted-foreground">Added</span>
							{:else}
								<form method="POST" action="?/add" use:enhance>
									<input type="hidden" name="stremioId" value={result.id} />
									<input type="hidden" name="type" value={result.type} />
									<input type="hidden" name="name" value={result.name} />
									<input type="hidden" name="poster" value={result.poster ?? ''} />
									<Button type="submit" variant="ghost" size="sm"><PlusIcon /> Add</Button>
								</form>
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={2} class="py-6 text-center text-muted-foreground">
							No results. Search needs an addon with a searchable catalog.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{/if}
</section>

<h2 class="mb-3 text-sm font-medium">In this collection</h2>
<Table.Root>
	<Table.Body>
		{#each data.items as item, index (item.stremioId)}
			<Table.Row>
				<Table.Cell>
					<div class="flex items-center gap-3">
						{@render poster(item.poster)}
						<div>
							<div class="font-medium">{item.name}</div>
							<div class="font-mono text-xs text-muted-foreground">{item.stremioId}</div>
						</div>
					</div>
				</Table.Cell>
				<Table.Cell class="w-32">
					<div class="flex justify-end">
						<RowActions
							id={item.stremioId}
							idField="stremioId"
							first={index === 0}
							last={index === data.items.length - 1}
						/>
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="stremioId" value={item.stremioId} />
							<Button type="submit" variant="ghost" size="icon-sm" aria-label="Remove {item.name}"
								><TrashIcon /></Button
							>
						</form>
					</div>
				</Table.Cell>
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={2} class="py-8 text-center text-muted-foreground"
					>Empty. Search above to add titles.</Table.Cell
				>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
