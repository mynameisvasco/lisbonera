<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import Logo from '#lib/components/brand/logo.svelte';
	import StatusDot from '#lib/components/status-dot.svelte';
	import * as Avatar from '#lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import HouseIcon from 'phosphor-svelte/lib/House';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
	import DevicesIcon from 'phosphor-svelte/lib/Devices';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
	import SignOutIcon from 'phosphor-svelte/lib/SignOut';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const nav = [
		{ href: resolve('/admin'), label: 'Overview', icon: HouseIcon, exact: true },
		{ href: resolve('/admin/libraries'), label: 'Libraries', icon: StackIcon },
		{ href: resolve('/admin/addons'), label: 'Addons', icon: PuzzlePieceIcon },
		{ href: resolve('/admin/devices'), label: 'Devices', icon: DevicesIcon },
		{ href: resolve('/admin/scrobbling'), label: 'Scrobbling', icon: ClockCounterClockwiseIcon }
	];

	function active(href: string, exact = false) {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}

	const initials = $derived(data.email.slice(0, 2).toUpperCase());
</script>

<div class="min-h-svh">
	<header class="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:px-6">
			<a
				href={resolve('/admin')}
				class="flex h-16 items-center rounded-lg"
				aria-label="Lisbonera overview"
			>
				<Logo />
			</a>

			<nav
				class="order-last -mx-4 flex w-[calc(100%+2rem)] [scrollbar-width:none] gap-1 overflow-x-auto px-4 pb-3 md:order-none md:mx-0 md:w-auto md:p-0"
				aria-label="Sections"
			>
				{#each nav as item (item.href)}
					{@const current = active(item.href, item.exact)}
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class={[
							'flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors',
							current
								? 'bg-foreground/[0.07] text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
						]}
					>
						<item.icon class="size-4" weight={current ? 'fill' : 'regular'} />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="ml-auto flex h-16 items-center gap-3">
				<span
					class="hidden items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground lg:flex"
				>
					<StatusDot />
					<span class="font-mono">{page.url.host}</span>
				</span>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="rounded-full" aria-label="Account">
						<Avatar.Root class="size-8">
							<Avatar.Fallback class="bg-cobalt text-xs font-semibold text-white"
								>{initials}</Avatar.Fallback
							>
						</Avatar.Root>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Label class="truncate font-normal text-muted-foreground"
							>{data.email}</DropdownMenu.Label
						>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Label>Appearance</DropdownMenu.Label>
							<DropdownMenu.RadioGroup
								value={userPrefersMode.current}
								onValueChange={(value) => setMode(value as 'light' | 'dark' | 'system')}
							>
								<DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a href="/cdn-cgi/access/logout" rel="external" {...props}
									><SignOutIcon /> Sign out</a
								>
							{/snippet}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
		{@render children()}
	</main>
</div>
