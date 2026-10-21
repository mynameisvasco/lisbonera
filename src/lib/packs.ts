/**
 * Collection packs from the Fusion Starter Kit (https://github.com/itsrenoria/fusion-starter-kit), a community
 * curation of artwork for Fusion. Each pack is a JSON list of `{ name, backgroundImageURL, layout }`; the
 * "sourced" variant adds the Trakt lists each collection follows. Artwork belongs to the credited creators.
 *
 * Generated from the kit's `json/collections` folder; any other URL in the same format can be imported too.
 */

import type { Shape } from './shapes';

export type PackShape = Shape;

export interface PackListing {
	id: string;
	category: string;
	shape: PackShape;
	author: string;
	style: string | null;
	count: number;
	url: string | null;
	sourcedUrl: string | null;
	samples: string[];
}

export const PACK_HOME = 'https://kit.betterer.cc/';

export const packs: PackListing[] = [
	{
		id: 'awards-poster-mousa.a',
		category: 'awards',
		shape: 'poster',
		author: 'mousa.a',
		style: null,
		count: 6,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-awards-poster-mousa.a.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-awards-poster-mousa.a.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/awards/poster/mousa.a/bafta-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/awards/poster/mousa.a/fisa-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/awards/poster/mousa.a/goldenglobes-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/awards/poster/mousa.a/iff-poster.png'
		]
	},
	{
		id: 'decades-poster-mousa.a',
		category: 'decades',
		shape: 'poster',
		author: 'mousa.a',
		style: null,
		count: 7,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-decades-poster-mousa.a.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-decades-poster-mousa.a.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/poster/mousa.a/1960s-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/poster/mousa.a/1970s-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/poster/mousa.a/1980s-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/poster/mousa.a/1990s-poster.png'
		]
	},
	{
		id: 'decades-square-orangebyte',
		category: 'decades',
		shape: 'square',
		author: 'orangebyte',
		style: null,
		count: 10,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-decades-square-orangebyte.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-decades-square-orangebyte.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/square/orangebyte/1930s-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/square/orangebyte/1940s-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/square/orangebyte/1950s-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/square/orangebyte/1960s-square.png'
		]
	},
	{
		id: 'decades-wide-mousa.a',
		category: 'decades',
		shape: 'wide',
		author: 'mousa.a',
		style: null,
		count: 7,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-decades-wide-mousa.a.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-decades-wide-mousa.a.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/mousa.a/1960s-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/mousa.a/1970s-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/mousa.a/1980s-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/mousa.a/1990s-wide.png'
		]
	},
	{
		id: 'decades-wide-rdnoni',
		category: 'decades',
		shape: 'wide',
		author: 'rdnoni',
		style: null,
		count: 5,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-decades-wide-rdnoni.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-decades-wide-rdnoni.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/rdnoni/1980s-wide.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/rdnoni/1990s-wide.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/rdnoni/2000s-wide.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/decades/wide/rdnoni/2010s-wide.jpg'
		]
	},
	{
		id: 'directors-wide-fexm92',
		category: 'directors',
		shape: 'wide',
		author: 'fexm92',
		style: null,
		count: 10,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-directors-wide-fexm92.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-directors-wide-fexm92.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/anderson-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/carpenter-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/depalma-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/fincher-wide.png'
		]
	},
	{
		id: 'genres-poster-dangeruex23',
		category: 'genres',
		shape: 'poster',
		author: 'dangeruex23',
		style: null,
		count: 21,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-poster-dangeruex23.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-poster-dangeruex23.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/dangeruex23/action-poster.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/dangeruex23/animation-poster.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/dangeruex23/animation2-poster.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/dangeruex23/comedy-poster.jpg'
		]
	},
	{
		id: 'genres-poster-mousa.a',
		category: 'genres',
		shape: 'poster',
		author: 'mousa.a',
		style: null,
		count: 10,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-poster-mousa.a.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-poster-mousa.a.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/mousa.a/action-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/mousa.a/comedy-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/mousa.a/crime-poster.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/poster/mousa.a/drama-poster.png'
		]
	},
	{
		id: 'genres-square-orangebyte-color',
		category: 'genres',
		shape: 'square',
		author: 'orangebyte',
		style: 'color',
		count: 14,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-square-orangebyte-color.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-square-orangebyte-color.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/color/action-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/color/adventure-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/color/anime-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/color/comedy-square-color.png'
		]
	},
	{
		id: 'genres-square-orangebyte-fusion',
		category: 'genres',
		shape: 'square',
		author: 'orangebyte',
		style: 'fusion',
		count: 13,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-square-orangebyte-fusion.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-square-orangebyte-fusion.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/fusion/action-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/fusion/adventure-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/fusion/anime-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/square/orangebyte/fusion/comedy-square-fusion.png'
		]
	},
	{
		id: 'genres-wide-dannyrutledge',
		category: 'genres',
		shape: 'wide',
		author: 'dannyrutledge',
		style: null,
		count: 56,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-wide-dannyrutledge.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-wide-dannyrutledge.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/dannyrutledge/action-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/dannyrutledge/action-adventures-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/dannyrutledge/action-thrillers-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/dannyrutledge/adult-animation-wide.png'
		]
	},
	{
		id: 'genres-wide-mousa.a',
		category: 'genres',
		shape: 'wide',
		author: 'mousa.a',
		style: null,
		count: 10,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-genres-wide-mousa.a.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-genres-wide-mousa.a.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/mousa.a/action-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/mousa.a/comedy-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/mousa.a/crime-wide.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/genres/wide/mousa.a/drama-wide.png'
		]
	},
	{
		id: 'streaming-square-orangebyte-color',
		category: 'streaming',
		shape: 'square',
		author: 'orangebyte',
		style: 'color',
		count: 17,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-square-orangebyte-color.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-square-orangebyte-color.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/color/appletv-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/color/bet-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/color/crunchyroll-square-color.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/color/curiositystream-square-color.png'
		]
	},
	{
		id: 'streaming-square-orangebyte-fusion',
		category: 'streaming',
		shape: 'square',
		author: 'orangebyte',
		style: 'fusion',
		count: 11,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-square-orangebyte-fusion.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-square-orangebyte-fusion.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/fusion/appletv-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/fusion/crunchyroll-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/fusion/disney-square-fusion.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/fusion/hbomax-square-fusion.png'
		]
	},
	{
		id: 'streaming-square-orangebyte',
		category: 'streaming',
		shape: 'square',
		author: 'orangebyte',
		style: null,
		count: 17,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-square-orangebyte.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-square-orangebyte.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/original/appletv-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/original/bet-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/original/crunchyroll-square.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/square/orangebyte/original/curiositystream-square.png'
		]
	},
	{
		id: 'streaming-wide-rdnoni-color',
		category: 'streaming',
		shape: 'wide',
		author: 'rdnoni',
		style: 'color',
		count: 17,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-wide-rdnoni-color.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-wide-rdnoni-color.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/color/angel-wide-color.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/color/appletv-wide-color.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/color/bbc-wide-color.jpg',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/color/crunchyroll-wide-color.jpg'
		]
	},
	{
		id: 'streaming-wide-rdnoni-tinted',
		category: 'streaming',
		shape: 'wide',
		author: 'rdnoni',
		style: 'tinted',
		count: 10,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-wide-rdnoni-tinted.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-wide-rdnoni-tinted.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/tinted/appletv-wide-tinted.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/tinted/crunchyroll-wide-tinted.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/tinted/discoveryplus-wide-tinted.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/tinted/disney-wide-tinted.png'
		]
	},
	{
		id: 'streaming-wide-rdnoni-transparent',
		category: 'streaming',
		shape: 'wide',
		author: 'rdnoni',
		style: 'transparent',
		count: 12,
		url: 'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-streaming-wide-rdnoni-transparent.json',
		sourcedUrl:
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/json/collections/collections-sourced-streaming-wide-rdnoni-transparent.json',
		samples: [
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/transparent/appletv-wide-transparent.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/transparent/crunchyroll-wide-transparent.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/transparent/discoveryplus-wide-transparent.png',
			'https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/streaming/wide/rdnoni/transparent/disney-wide-transparent.png'
		]
	}
];
