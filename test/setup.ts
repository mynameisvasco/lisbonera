import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { memo } from '../src/lib/server/scope';
import { network } from './network';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeAll(() => network.enable());
afterEach(() => {
	network.resetHandlers();
	memo.clear();
});
afterAll(() => network.disable());
