'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { submitShuffleAgainst } from '@/lib/submitCore';

function readIp(headerList: Headers): string {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = headerList.get('x-real-ip');
  if (real) return real.trim();
  return '0.0.0.0';
}

export async function submitShuffle(sequence: number[]): Promise<void> {
  const headerList = await headers();
  const ip = readIp(headerList);
  const db = getDb();
  const result = await submitShuffleAgainst(db, sequence, ip);
  redirect(`/result/${result.hash}?via=${result.via}`);
}
