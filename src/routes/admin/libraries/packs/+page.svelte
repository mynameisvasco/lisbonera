<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/components/page-header.svelte';
	import Poster from '#lib/components/poster.svelte';
	import Section from '#lib/components/section.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { PACK_HOME, packs, type PackListing } from '#lib/packs.js';
	import { SHAPE_LABEL } from '#lib/shapes.js';

	const order = ['genres', 'streaming', 'decades', 'awards', 'directors'];
	const groups = $derived(
		[...new Set(packs.map((pack) => pack.category))]
			.sort((a, b) => order.indexOf(a) - order.indexOf(b))
			.map((category) => ({
				category,
				label: category.charAt(0).toUpperCase() + category.slice(1),
				packs: packs.filter((pack) => pack.category === category)
			}))
	);

	function badge(pack: PackListing) {
		return [SHAPE_LABEL[pack.shape], pack.style].filter(Boolean).join(' · ');
	}
</script>

<svelte:head><title>Packs · Lisbonera</title></svelte:head>

<PageHeader title="Packs" back={{ href: resolve('/admin/libraries'), label: 'Libraries' }}>
	{#snippet meta()}
		<p>
			Artwork sets from the
			<a
				href={PACK_HOME}
				target="_blank"
				rel="external noreferrer"
				class="text-primary underline-offset-4 hover:underline">Fusion Starter Kit</a
			>. Each becomes a set of collections, or restyles the libraries you already have.
		</p>
	{/snippet}
</PageHeader>

{#each groups as group (group.category)}
	<Section id="packs-{group.category}" title={group.label}>
		<ul class="grid gap-4 sm:grid-cols-2">
			{#each group.packs as pack (pack.id)}
				{@const href = resolve('/admin/libraries/packs/[id]', { id: pack.id })}
				<li class="flex flex-col gap-4 rounded-xl border bg-card p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<a {href} class="block truncate font-medium underline-offset-4 hover:underline"
								>{group.label}</a
							>
							<p class="truncate text-xs text-muted-foreground">
								by {pack.author} · {pack.count}{pack.sourcedUrl ? ' · with Trakt lists' : ''}
							</p>
						</div>
						<Badge variant="outline" class="shrink-0">{badge(pack)}</Badge>
					</div>
					<a {href} class="-mx-4 flex gap-2 overflow-hidden px-4" tabindex="-1" aria-hidden="true">
						{#each pack.samples as src (src)}
							<Poster
								{src}
								title=""
								shape={pack.shape}
								class={pack.shape === 'wide' ? 'w-[70%] shrink-0' : 'w-[30%] shrink-0'}
							/>
						{/each}
					</a>
					<Button {href} variant="secondary" class="w-full">Use</Button>
				</li>
			{/each}
		</ul>
	</Section>
{/each}

<Section id="custom-pack" title="Other packs">
	<form
		method="GET"
		action={resolve('/admin/libraries/packs/[id]', { id: 'custom' })}
		class="flex max-w-2xl gap-2"
	>
		<Input
			name="url"
			type="url"
			required
			placeholder="https://…/collections.json"
			autocomplete="off"
			class="font-mono text-sm"
			aria-label="Pack URL"
		/>
		<Button type="submit" variant="secondary">Open</Button>
	</form>
	<p class="mt-2 text-xs text-muted-foreground">
		Any Fusion collections or widgets export works: a JSON list of names and image URLs.
	</p>
</Section>
