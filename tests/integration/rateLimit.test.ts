import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { recordAndCheckRateLimit, RateLimitError } from '@/lib/rateLimit';

describe('rate limiter', () => {
  it('allows up to 60 submissions per IP per hour', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
  });

  it('rejects the 61st submission in the same window', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
    await expect(
      recordAndCheckRateLimit(db, '203.0.113.5'),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('tracks separate IPs separately', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
    await recordAndCheckRateLimit(db, '203.0.113.6');
  });
});
