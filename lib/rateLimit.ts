import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { rateLimits } from './schema';

export const RATE_LIMIT_PER_HOUR = 60;

export class RateLimitError extends Error {
  constructor() {
    super('Too many submissions, try again later.');
    this.name = 'RateLimitError';
  }
}

export async function recordAndCheckRateLimit(
  db: Db,
  ip: string,
): Promise<void> {
  const result = await db
    .insert(rateLimits)
    .values({
      ip,
      windowStart: sql`date_trunc('hour', now())`,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimits.ip, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const newCount = result[0]?.count;
  if (newCount === undefined) {
    throw new Error('Rate limit upsert returned no rows');
  }
  if (newCount > RATE_LIMIT_PER_HOUR) {
    throw new RateLimitError();
  }

  // Lazy cleanup: remove old buckets for this IP (fire-and-forget for cost).
  await db
    .delete(rateLimits)
    .where(
      sql`${rateLimits.ip} = ${ip} AND ${rateLimits.windowStart} < now() - interval '24 hours'`,
    );
}
