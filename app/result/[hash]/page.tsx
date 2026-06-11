export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { shuffles } from '@/lib/schema';
import { computeAllStats } from '@/lib/stats';
import { findClosestMatch } from '@/lib/closest';
import { VerdictBanner } from '@/components/VerdictBanner';
import { VisualStrip } from '@/components/VisualStrip';
import { StatsPanel } from '@/components/StatsPanel';
import { ClosestMatchPanel } from '@/components/ClosestMatchPanel';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { headers } from 'next/headers';

type Params = { hash: string };
type Search = { via?: 'new' | 'match' };

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { hash } = await params;
  const { via } = await searchParams;
  const db = getDb();

  const targetRows = await db
    .select()
    .from(shuffles)
    .where(eq(shuffles.hash, hash))
    .limit(1);

  if (targetRows.length === 0) {
    notFound();
  }
  const target = targetRows[0];

  const others = await db
    .select({
      id: shuffles.id,
      sequence: shuffles.sequence,
      createdAt: shuffles.createdAt,
    })
    .from(shuffles)
    .where(ne(shuffles.hash, hash));

  const closest = findClosestMatch(
    target.sequence,
    others.map((r) => ({
      id: r.id,
      sequence: r.sequence,
      createdAt: r.createdAt,
    })),
  );

  const stats = computeAllStats(target.sequence);

  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const url = `${protocol}://${host}/result/${hash}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <VerdictBanner
        {...(via === 'new'
          ? { kind: 'new', submissionNumber: target.id }
          : via === 'match'
            ? {
                kind: 'match',
                originalNumber: target.id,
                originalDate: target.createdAt,
              }
            : {
                kind: 'permalink',
                submissionNumber: target.id,
                recordedDate: target.createdAt,
              })}
      />

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Your shuffle</h2>
        <VisualStrip sequence={target.sequence} />
      </section>

      <StatsPanel stats={stats} />

      <ClosestMatchPanel target={target.sequence} closest={closest} />

      <section className="flex items-center gap-4 mb-8">
        <CopyLinkButton url={url} />
        <Link
          href="/"
          className="text-sm px-3 py-1.5 rounded bg-zinc-900 text-white"
        >
          Submit another
        </Link>
      </section>
    </main>
  );
}
