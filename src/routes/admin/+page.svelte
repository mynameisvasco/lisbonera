<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyButton from '#lib/components/copy-button.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import Poster from '#lib/components/poster.svelte';
	import { timeAgo } from '#lib/format.js';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import CircleIcon from 'phosphor-svelte/lib/Circle';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const setup = $derived([
		{
			done: data.addons.streams > 0,
			label: 'Install a stream addon',
			detail: 'Without one, apps can browse but not play.',
			route: '/admin/addons' as const
		},
		{
			done: data.devices.passwords > 0,
			label: 'Add a device',
			detail: 'Create an app password and sign in from a Jellyfin app.',
			route: '/admin/devices' as const
		},
		{
			done: data.scrobbler !== null,
			label: 'Connect Trakt',
			detail: 'Optional. Enables progress, watched state and Next Up.',
			route: '/admin/scrobbling' as const
		}
	]);
	const pending = $derived(setup.some((step) => !step.done));
	const typeLabel = { movie: 'Movies', series: 'Series', mixed: 'Mixed' } as const;
</script>

<svelte:head><title>Overview · Lisbonera</title></svelte:head>

<PageHeader title="Overview">
	{#snippet meta()}
		<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span class="inline-flex items-center gap-0.5">
				<span class="font-mono text-foreground">{data.host}</span>
				<CopyButton value={data.server} label="Copy server address" />
			</span>
			<span aria-hidden="true">·</span>
			<span>
				{#if data.devices.lastSeen}
					{data.devices.lastSeen.client} seen {timeAgo(data.devices.lastSeen.at).toLowerCase()}
				{:else}
					No device signed in
				{/if}
			</span>
			<span aria-hidden="true">·</span>
			<span class={data.scrobbler?.failing ? 'text-terracotta' : ''}>
				{#if data.scrobbler}
					Trakt {data.scrobbler.failing ? 'failing' : 'on'}
				{:else}
					Trakt off
				{/if}
			</span>
			{#if data.addons.failing}
				<span aria-hidden="true">·</span>
				<a
					href={resolve('/admin/addons')}
					class="text-terracotta underline-offset-4 hover:underline"
				>
					{data.addons.failing}
					{data.addons.failing === 1 ? 'addon' : 'addons'} failing
				</a>
			{/if}
		</p>
	{/snippet}
</PageHeader>

{#if pending}
	<section class="mb-12" aria-labelledby="setup">
		<h2 id="setup" class="mb-2 text-[13px] font-medium text-muted-foreground">Setup</h2>
		<ol class="divide-y border-y">
			{#each setup as step (step.label)}
				<li>
					<a
						href={resolve(step.route)}
						class="group flex items-center gap-3 py-3 text-sm"
						aria-label="{step.label}{step.done ? ' (done)' : ''}"
					>
						{#if step.done}
							<CheckCircleIcon weight="fill" class="size-5 shrink-0 text-primary" />
						{:else}
							<CircleIcon class="size-5 shrink-0 text-muted-foreground" />
						{/if}
						<span class="min-w-0 flex-1">
							<span class={step.done ? 'text-muted-foreground line-through' : 'font-medium'}
								>{step.label}</span
							>
							{#if !step.done}
								<span class="block text-xs text-muted-foreground sm:ml-2 sm:inline"
									>{step.detail}</span
								>
							{/if}
						</span>
						<CaretRightIcon class="size-4 text-muted-foreground group-hover:text-foreground" />
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<section aria-labelledby="home-screen">
	<div class="mb-4 flex items-baseline justify-between gap-4">
		<h2 id="home-screen" class="text-[13px] font-medium text-muted-foreground">Home screen</h2>
		<a
			href={resolve('/admin/libraries')}
			class="text-sm text-primary underline-offset-4 hover:underline">Arrange</a
		>
	</div>

	{#each data.shelves as shelf (shelf.id)}
		<div class="mb-10">
			<h3 class="mb-3 text-[15px] font-medium">
				{shelf.name}
				<span class="ml-1 text-xs font-normal text-muted-foreground">{typeLabel[shelf.type]}</span>
			</h3>
			{#if shelf.items.length}
				<ul
					class="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
				>
					{#each shelf.items as item (item.id)}
						<li class="w-32 shrink-0 snap-start lg:w-44">
							<Poster src={item.poster} title={item.name} />
							<p class="mt-2 truncate text-xs text-muted-foreground" title={item.name}>
								{item.name}
							</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">
					Empty. The catalog returned nothing or its addon is unreachable.
				</p>
			{/if}
		</div>
	{:else}
		<p class="border-y py-6 text-sm text-muted-foreground">
			No libraries are shown.
			<a href={resolve('/admin/libraries')} class="text-primary underline-offset-4 hover:underline"
				>Choose libraries</a
			>
		</p>
	{/each}
</section>
