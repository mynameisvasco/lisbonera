import type { ComponentProps } from 'svelte';
import type { DragDropProvider } from '@dnd-kit/svelte';
import { arrayMove } from '@dnd-kit/helpers';
import { isSortable } from '@dnd-kit/svelte/sortable';

type DragEndEvent = Parameters<
	NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
>[0];

/** The list after a finished sortable drag, or `null` when nothing moved. */
export function reorderAfterDrag<T>(items: T[], event: DragEndEvent): T[] | null {
	const source = event.operation.source;
	if (event.canceled || !isSortable(source) || source.initialIndex === source.index) return null;
	return arrayMove(items, source.initialIndex, source.index);
}
