import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Permissive Drizzle type so library helpers can accept both the
// production (neon-http) and test (pglite) clients without coupling.
export type Db = PgDatabase<any, any, any>;

let cached: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = neon(url);
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
