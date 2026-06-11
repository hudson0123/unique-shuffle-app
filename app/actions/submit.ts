'use server';

import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { submitShuffleAgainst, type SubmitResult } from '@/lib/submitCore';

function readIp(headerList: Headers): string {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = headerList.get('x-real-ip');
  if (real) return real.trim();
  return '0.0.0.0';
}

export async function submitShuffle(sequence: number[]): Promise<SubmitResult> {
  const headerList = await headers();
  const ip = readIp(headerList);
  const db = getDb();
  try {
    return await submitShuffleAgainst(db, sequence, ip);
  } catch (e) {
    console.error('submitShuffle failed', e);
    throw e;
  }
}
