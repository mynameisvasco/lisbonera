<script lang="ts">
	import Poster from '#lib/components/poster.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { packs, type PackListing } from '#lib/packs.js';
	import { SHAPE_ASPECT, SHAPE_LABEL, type Shape } from '#lib/shapes.js';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';

	interface PackImage {
		name: string;
		image: string;
		shape: Shape;
	}

	let {
		open = $bindable(false),
		name,
		onPick
	}: {
		open?: boolean;
		/** The library name; matching artwork is listed first. */
		name: string;
		onPick: (image: { url: string; aspect: number }) => void;
	} = $props();

	let pack = $state<PackListing | null>(null);
	let images = $state<PackImage[]>([]);
	let loading = $state(false);
	let failed = $state('');

	const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
	const sorted = $derived(
		[...images].sort(
			(a, b) =>
				Number(normalized(b.name) === normalized(name)) -
				Number(normalized(a.name) === normalized(name))
		)
	);

	async function choose(next: PackListing) {
		pack = next;
		images = [];
		failed = '';
		loading = true;
		try {
			const response = await fetch(`/admin/libraries/packs/${encodeURIComponent(next.id)}/items`);
			if (!response.ok) throw new Error();
			images = await response.json();
		} catch {
			failed = 'Could not load this pack.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!open) pack = null;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[85svh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title
				>{pack ? `${pack.category} by ${pack.author}` : 'Choose from a pack'}</Dialog.Title
			>
			<Dialog.Description>
				{pack ? 'Pick the artwork for this library.' : 'Artwork from the Fusion Starter Kit.'}
			</Dialog.Description>
		</Dialog.Header>

		<div class="-mx-6 overflow-y-auto px-6">
			{#if !pack}
				<ul class="grid gap-2 sm:grid-cols-2">
					{#each packs as item (item.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted"
								onclick={() => choose(item)}
							>
								<Poster
									src={item.samples[0]}
									title=""
									shape={item.shape}
									class={item.shape === 'wide' ? 'h-10' : 'h-12'}
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium capitalize">{item.category}</span>
									<span class="block truncate text-xs text-muted-foreground">
										{item.author} · {SHAPE_LABEL[item.shape]}{item.style ? ` · ${item.style}` : ''}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<Button variant="ghost" size="sm" class="mb-3 -ml-2" onclick={() => (pack = null)}>
					<ArrowLeftIcon /> All packs
				</Button>
				{#if loading}
					<p class="flex items-center gap-2 text-sm text-muted-foreground">
						<Spinner /> Loading
					</p>
				{:else if failed}
					<p class="text-sm text-terracotta">{failed}</p>
				{:else}
					<ul
						class={[
							'grid gap-3',
							pack.shape === 'wide' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-5'
						]}
					>
						{#each sorted as image (image.image)}
							<li>
								<button
									type="button"
									class="block w-full rounded-md text-left"
									onclick={() => {
										onPick({ url: image.image, aspect: SHAPE_ASPECT[image.shape] });
										open = false;
									}}
								>
									<Poster
										src={image.image}
										title={image.name}
										shape={image.shape}
										class="transition hover:ring-2 hover:ring-primary"
									/>
									<p class="mt-1.5 truncate text-xs text-muted-foreground">{image.name}</p>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
