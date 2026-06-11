import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { hashSequence, isValidSequence } from './deck';
import { recordAndCheckRateLimit } from './rateLimit';
import { shuffles } from './schema';

export class InvalidSequenceError extends Error {
  constructor() {
    super('Invalid card sequence.');
    this.name = 'InvalidSequenceError';
  }
}

export type SubmitResult = {
  hash: string;
  via: 'new' | 'match';
};

export async function submitShuffleAgainst(
  db: Db,
  sequence: number[],
  ip: string,
): Promise<SubmitResult> {
  if (!isValidSequence(sequence)) {
    throw new InvalidSequenceError();
  }

  await recordAndCheckRateLimit(db, ip);

  const hash = hashSequence(sequence);

  const existing = await db
    .select({ id: shuffles.id })
    .from(shuffles)
    .where(eq(shuffles.hash, hash))
    .limit(1);

  if (existing.length > 0) {
    return { hash, via: 'match' };
  }

  try {
    await db.insert(shuffles).values({ hash, sequence });
    return { hash, via: 'new' };
  } catch (e) {
    const recheck = await db
      .select({ id: shuffles.id })
      .from(shuffles)
      .where(eq(shuffles.hash, hash))
      .limit(1);
    if (recheck.length > 0) {
      return { hash, via: 'match' };
    }
    throw e;
  }
}
