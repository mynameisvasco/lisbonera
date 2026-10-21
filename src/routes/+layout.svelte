<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0d12" />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fcfcfa" />
</svelte:head>

<ModeWatcher defaultMode="dark" />
<Toaster />
{@render children()}
