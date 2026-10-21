export type Shape = 'poster' | 'wide' | 'square';

/** Width divided by height for each artwork shape Jellyfin apps and packs use. */
export const SHAPE_ASPECT: Record<Shape, number> = { poster: 2 / 3, wide: 16 / 9, square: 1 };

export const SHAPE_LABEL: Record<Shape, string> = {
	poster: 'Poster',
	wide: 'Wide',
	square: 'Square'
};

/** The closest named shape for a stored aspect ratio. */
export function shapeOf(aspect: number | null | undefined): Shape {
	if (!aspect) return 'wide';
	if (aspect < 0.85) return 'poster';
	if (aspect < 1.3) return 'square';
	return 'wide';
}
