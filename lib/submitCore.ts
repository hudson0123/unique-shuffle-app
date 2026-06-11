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

  const inserted = await db
    .insert(shuffles)
    .values({ hash, sequence })
    .onConflictDoNothing({ target: shuffles.hash })
    .returning({ id: shuffles.id });

  if (inserted.length > 0) {
    return { hash, via: 'new' };
  }

  const existing = await db
    .select({ id: shuffles.id })
    .from(shuffles)
    .where(eq(shuffles.hash, hash))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Submission conflicted but row not found');
  }

  return { hash, via: 'match' };
}
