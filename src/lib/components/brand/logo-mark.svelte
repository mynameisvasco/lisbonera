<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	let { class: className, ...rest }: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg viewBox="0 0 64 64" class={className} aria-hidden="true" {...rest}>
	<rect width="64" height="64" rx="16" fill="var(--brand-cobalt)" />
	<path
		d="M15 13.5a2.5 2.5 0 0 1 2.5-2.5h7a2.5 2.5 0 0 1 2.5 2.5V38h20.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-28A4.5 4.5 0 0 1 15 45.5z"
		fill="#fff"
	/>
	<path
		d="M32 15.6c0-1.9 2-3 3.6-2.1l13.3 7.7c1.6.9 1.6 3.3 0 4.2l-13.3 7.7c-1.6.9-3.6-.3-3.6-2.1z"
		fill="var(--brand-tram)"
	/>
</svg>
