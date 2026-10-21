import { guid } from './crypto';
import { memo } from './scope';

export type ItemKind = 'movie' | 'series' | 'season' | 'episode';

export interface IdEntry {
	guid: string;
	kind: ItemKind;
	/** Movie or series id as the addons know it (`tt0111161`, `kitsu:1`). Seasons and episodes keep their series id. */
	stremioId: string;
	season: number | null;
	episode: number | null;
	/** Stremio video id used for stream requests of an episode. */
	videoId: string | null;
	name: string | null;
	poster: string | null;
	background: string | null;
	logo: string | null;
	runtimeTicks: number | null;
}

export type IdInput = Pick<IdEntry, 'kind' | 'stremioId'> &
	Partial<Omit<IdEntry, 'guid' | 'kind' | 'stremioId'>>;

interface IdRow {
	guid: string;
	kind: ItemKind;
	stremio_id: string;
	season: number | null;
	episode: number | null;
	video_id: string | null;
	name: string | null;
	poster: string | null;
	background: string | null;
	logo: string | null;
	runtime_ticks: number | null;
}

const MEMO_TTL = 24 * 3600 * 1000;
const COLUMNS = 11;
/** D1 allows 100 bound parameters per statement. */
const ROWS_PER_STATEMENT = Math.floor(100 / COLUMNS);

/** Ids are derived from Stremio identity only, so the same title always gets the same Jellyfin id. */
export function itemGuid(
	kind: ItemKind,
	stremioId: string,
	season?: number | null,
	episode?: number | null
) {
	return guid(`${kind}|${stremioId}|${season ?? ''}|${episode ?? ''}`);
}

function fromRow(row: IdRow): IdEntry {
	return {
		guid: row.guid,
		kind: row.kind,
		stremioId: row.stremio_id,
		season: row.season,
		episode: row.episode,
		videoId: row.video_id,
		name: row.name,
		poster: row.poster,
		background: row.background,
		logo: row.logo,
		runtimeTicks: row.runtime_ticks
	};
}

/**
 * Maps Jellyfin GUIDs back to Stremio ids. Registrations are buffered and written in one batch per response;
 * existing rows are only touched to fill in a missing runtime or poster.
 */
export class IdMap {
	readonly #db: D1Database;
	readonly #pending = new Map<string, IdEntry>();

	constructor(db: D1Database) {
		this.#db = db;
	}

	async register(input: IdInput): Promise<IdEntry> {
		const id = await itemGuid(input.kind, input.stremioId, input.season, input.episode);
		const known = memo.get<IdEntry>(`id:${id}`, MEMO_TTL)?.value;
		const entry: IdEntry = {
			guid: id,
			kind: input.kind,
			stremioId: input.stremioId,
			season: input.season ?? null,
			episode: input.episode ?? null,
			videoId: input.videoId ?? known?.videoId ?? null,
			name: input.name ?? known?.name ?? null,
			poster: input.poster ?? known?.poster ?? null,
			background: input.background ?? known?.background ?? null,
			logo: input.logo ?? known?.logo ?? null,
			runtimeTicks: input.runtimeTicks ?? known?.runtimeTicks ?? null
		};
		const changed =
			!known ||
			(known.runtimeTicks === null && entry.runtimeTicks !== null) ||
			(known.poster === null && entry.poster !== null);
		memo.set(`id:${id}`, entry);
		if (changed) this.#pending.set(id, entry);
		return entry;
	}

	async resolve(id: string): Promise<IdEntry | null> {
		if (!/^[0-9a-f]{32}$/.test(id)) return null;
		const pending = this.#pending.get(id);
		if (pending) return pending;
		const known = memo.get<IdEntry>(`id:${id}`, MEMO_TTL);
		if (known) return known.value;
		const row = await this.#db
			.prepare('SELECT * FROM id_map WHERE guid = ?')
			.bind(id)
			.first<IdRow>();
		if (!row) return null;
		const entry = fromRow(row);
		memo.set(`id:${id}`, entry);
		return entry;
	}

	async flush(): Promise<void> {
		if (this.#pending.size === 0) return;
		const entries = [...this.#pending.values()];
		this.#pending.clear();
		const statements: D1PreparedStatement[] = [];
		for (let i = 0; i < entries.length; i += ROWS_PER_STATEMENT) {
			const chunk = entries.slice(i, i + ROWS_PER_STATEMENT);
			const placeholders = chunk.map(() => `(${Array(COLUMNS).fill('?').join(', ')})`).join(', ');
			statements.push(
				this.#db
					.prepare(
						`INSERT INTO id_map (guid, kind, stremio_id, season, episode, video_id, name, poster, background, logo, runtime_ticks)
						VALUES ${placeholders}
						ON CONFLICT (guid) DO UPDATE SET
							runtime_ticks = coalesce(id_map.runtime_ticks, excluded.runtime_ticks),
							poster = coalesce(id_map.poster, excluded.poster),
							video_id = coalesce(id_map.video_id, excluded.video_id)
						WHERE (id_map.runtime_ticks IS NULL AND excluded.runtime_ticks IS NOT NULL)
							OR (id_map.poster IS NULL AND excluded.poster IS NOT NULL)`
					)
					.bind(
						...chunk.flatMap((entry) => [
							entry.guid,
							entry.kind,
							entry.stremioId,
							entry.season,
							entry.episode,
							entry.videoId,
							entry.name,
							entry.poster,
							entry.background,
							entry.logo,
							entry.runtimeTicks
						])
					)
			);
		}
		await this.#db.batch(statements);
	}
}
