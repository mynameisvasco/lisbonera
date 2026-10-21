import type { Session } from '../auth/client';
import { guid } from '../crypto';
import type { Query } from '../http';
import type { IdMap } from '../ids';
import type { Scope } from '../scope';
import type { DtoContext } from './dto';

export interface JfContext extends Scope {
	request: Request;
	url: URL;
	query: Query;
	params: Record<string, string>;
	session: Session | null;
	ids: IdMap;
	dto: DtoContext;
	username: string;
}

export async function dtoContext(origin: string, username: string): Promise<DtoContext> {
	const [serverId, userId] = await Promise.all([
		guid(`server|${origin}`),
		guid(`user|${username.toLowerCase()}`)
	]);
	return { serverId, userId };
}
