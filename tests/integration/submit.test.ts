import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { submitShuffleAgainst } from '@/lib/submitCore';
import { shuffles } from '@/lib/schema';

const sortedSeq = Array.from({ length: 52 }, (_, i) => i);

describe('submitShuffle core', () => {
  it('inserts a new shuffle and returns via=new with the hash', async () => {
    const { db } = await createTestDb();
    const result = await submitShuffleAgainst(db, sortedSeq, '203.0.113.1');
    expect(result.via).toBe('new');
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);

    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
  });

  it('treats a duplicate submission as via=match without inserting a second row', async () => {
    const { db } = await createTestDb();
    await submitShuffleAgainst(db, sortedSeq, '203.0.113.1');
    const result = await submitShuffleAgainst(db, sortedSeq, '203.0.113.2');
    expect(result.via).toBe('match');

    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
  });

  it('rejects invalid sequences', async () => {
    const { db } = await createTestDb();
    await expect(
      submitShuffleAgainst(db, [0, 1, 2], '203.0.113.1'),
    ).rejects.toThrow();
  });
});
