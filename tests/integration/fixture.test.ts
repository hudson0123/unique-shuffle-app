import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { shuffles } from '@/lib/schema';

describe('test db fixture', () => {
  it('runs migrations and can insert a row', async () => {
    const { db } = await createTestDb();
    await db.insert(shuffles).values({
      hash: 'deadbeef'.repeat(8),
      sequence: Array.from({ length: 52 }, (_, i) => i),
    });
    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
    expect(rows[0].sequence).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });
});
