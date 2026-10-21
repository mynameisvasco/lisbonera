<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();
	const id = `azulejo-${Math.random().toString(36).slice(2, 8)}`;
</script>

<!-- A quiet azulejo grid: quarter arcs that meet into circles across tiles. -->
<svg class={cn('pointer-events-none absolute inset-0 size-full', className)} aria-hidden="true">
	<defs>
		<pattern {id} width="56" height="56" patternUnits="userSpaceOnUse">
			<g fill="none" stroke="currentColor" stroke-width="1">
				<rect width="56" height="56" />
				<circle cx="28" cy="28" r="12" />
				<path
					d="M0 14a14 14 0 0 0 14-14M42 0a14 14 0 0 0 14 14M56 42a14 14 0 0 0-14 14M14 56A14 14 0 0 0 0 42"
				/>
			</g>
		</pattern>
	</defs>
	<rect width="100%" height="100%" fill="url(#{id})" />
</svg>
