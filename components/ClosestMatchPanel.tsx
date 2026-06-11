import { VisualStrip } from './VisualStrip';
import type { ClosestMatch } from '@/lib/closest';

type Props = {
  target: number[];
  closest: ClosestMatch | null;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ClosestMatchPanel({ target, closest }: Props) {
  if (closest === null) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Closest prior match</h2>
        <p className="text-sm text-zinc-600">
          No other shuffles to compare against yet — you&rsquo;re the first.
        </p>
      </section>
    );
  }

  const highlights = new Set<number>();
  for (let i = 0; i < target.length; i++) {
    if (target[i] === closest.sequence[i]) highlights.add(i);
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-3">Closest prior match</h2>
      <p className="text-sm text-zinc-700 mb-3">
        <strong className="tabular-nums">{closest.matchCount}</strong>/52 cards
        in the same position as{' '}
        <strong>Shuffle #{closest.id.toLocaleString()}</strong> (submitted{' '}
        {formatDate(closest.createdAt)}).
      </p>
      <VisualStrip sequence={closest.sequence} highlightIndexes={highlights} />
    </section>
  );
}
