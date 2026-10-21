<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Azulejo from '#lib/components/azulejo.svelte';
	import Poster from '#lib/components/poster.svelte';
	import StatusDot from '#lib/components/status-dot.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { timeAgo } from '#lib/format.js';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import DevicesIcon from 'phosphor-svelte/lib/Devices';
	import PlayIcon from 'phosphor-svelte/lib/Play';
	import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const collage = $derived(
		data.shelves
			.flatMap((shelf) => shelf.items)
			.filter((item) => item.poster)
			.slice(0, 9)
	);

	async function copyAddress() {
		await navigator.clipboard.writeText(data.server);
		toast.success('Server address copied');
	}

	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Mixed' } as const;
</script>

<svelte:head><title>Overview · Lisbonera</title></svelte:head>

<section class="relative isolate overflow-hidden rounded-[1.75rem] bg-cobalt text-white">
	<Azulejo class="text-white/[0.06]" />
	<div class="relative grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="min-w-0">
			<span
				class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium"
			>
				<StatusDot /> Online
			</span>
			<h1 class="mt-5 truncate font-mono text-2xl font-medium tracking-tight sm:text-4xl">
				{data.host}
			</h1>
			<p class="mt-2 text-sm text-white/70">
				Jellyfin server for <span class="text-white">{data.username}</span> · {data.shelves.length}
				{data.shelves.length === 1 ? 'library' : 'libraries'} · {data.addons.enabled}
				{data.addons.enabled === 1 ? 'addon' : 'addons'}
			</p>
			<div class="mt-8 flex flex-wrap gap-2">
				<Button href={resolve('/admin/devices')} class="bg-tram text-neutral-950 hover:bg-tram/90">
					<PlayIcon weight="fill" /> Connect a device
				</Button>
				<Button
					variant="ghost"
					class="text-white hover:bg-white/10 hover:text-white"
					onclick={copyAddress}
				>
					<CopyIcon /> Copy address
				</Button>
			</div>
		</div>

		{#if collage.length >= 6}
			<div class="relative hidden h-64 lg:block" aria-hidden="true">
				<div
					class="absolute inset-0 grid -rotate-[8deg] grid-cols-3 gap-3 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
				>
					{#each [0, 1, 2] as column (column)}
						<div class={['flex flex-col gap-3', column === 1 && '-translate-y-10']}>
							{#each collage.filter((_, index) => index % 3 === column) as item (item.id)}
								<Poster src={item.poster} title={item.name} class="shadow-2xl ring-white/10" />
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>

<section class="mt-4 grid gap-4 sm:grid-cols-3">
	{#snippet tile(
		route: '/admin/addons' | '/admin/devices' | '/admin/scrobbling',
		Icon: typeof StackIcon,
		label: string,
		value: string,
		detail: string,
		warn = false
	)}
		<a
			href={resolve(route)}
			class="group flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
		>
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
			>
				<Icon class="size-5" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-xs text-muted-foreground">{label}</span>
				<span class="mt-0.5 block truncate font-medium">{value}</span>
				<span
					class={[
						'mt-0.5 block truncate text-xs',
						warn ? 'text-terracotta' : 'text-muted-foreground'
					]}
				>
					{detail}
				</span>
			</span>
			<ArrowRightIcon
				class="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</a>
	{/snippet}

	{@render tile(
		'/admin/addons',
		PuzzlePieceIcon,
		'Addons',
		`${data.addons.enabled} enabled`,
		data.addons.failing
			? `${data.addons.failing} reporting errors`
			: data.addons.streams
				? `${data.addons.streams} with streams`
				: 'No stream addon yet',
		data.addons.failing > 0 || data.addons.streams === 0
	)}
	{@render tile(
		'/admin/devices',
		DevicesIcon,
		'Devices',
		`${data.devices.passwords} app ${data.devices.passwords === 1 ? 'password' : 'passwords'}`,
		data.devices.lastSeen
			? `${data.devices.lastSeen.client} · ${timeAgo(data.devices.lastSeen.at)}`
			: 'No client signed in yet'
	)}
	{@render tile(
		'/admin/scrobbling',
		ClockCounterClockwiseIcon,
		'Scrobbling',
		data.scrobbler
			? `${data.scrobbler.provider === 'trakt' ? 'Trakt' : data.scrobbler.provider}`
			: 'Off',
		data.scrobbler
			? data.scrobbler.failing
				? 'Last sync failed'
				: `as ${data.scrobbler.username ?? 'unknown'}`
			: 'Progress is not tracked',
		Boolean(data.scrobbler?.failing)
	)}
</section>

<section class="mt-12">
	<div class="mb-5 flex items-end justify-between gap-4">
		<div>
			<h2 class="text-lg font-semibold tracking-tight">In your clients</h2>
			<p class="text-sm text-muted-foreground">Libraries in the order Jellyfin apps show them.</p>
		</div>
		<Button variant="outline" size="sm" href={resolve('/admin/libraries')}>Arrange</Button>
	</div>

	{#each data.shelves as shelf (shelf.id)}
		<div class="mb-8">
			<div class="mb-3 flex items-baseline gap-2">
				<h3 class="font-medium">{shelf.name}</h3>
				<span class="text-xs text-muted-foreground">{typeLabel[shelf.type]}</span>
			</div>
			{#if shelf.items.length}
				<div
					class="-mx-4 flex snap-x [scrollbar-width:thin] gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
				>
					{#each shelf.items as item (item.id)}
						<figure class="w-28 shrink-0 snap-start sm:w-32">
							<Poster src={item.poster} title={item.name} />
							<figcaption class="mt-2 truncate text-xs text-muted-foreground" title={item.name}>
								{item.name}
							</figcaption>
						</figure>
					{/each}
				</div>
			{:else}
				<p class="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
					Nothing to show. The catalog may be empty or its addon unreachable.
				</p>
			{/if}
		</div>
	{:else}
		<Empty.Root class="rounded-2xl border border-dashed">
			<Empty.Header>
				<Empty.Media variant="icon"><StackIcon /></Empty.Media>
				<Empty.Title>No libraries enabled</Empty.Title>
				<Empty.Description
					>Enable a catalog or create a collection to fill your clients.</Empty.Description
				>
			</Empty.Header>
			<Empty.Content>
				<Button href={resolve('/admin/libraries')}>Open libraries</Button>
			</Empty.Content>
		</Empty.Root>
	{/each}
</section>
