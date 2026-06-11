import type { ShuffleStats } from '@/lib/stats';

type Tile = { label: string; value: number; description: string };

function tiles(stats: ShuffleStats): Tile[] {
  return [
    {
      label: 'Longest same-suit run',
      value: stats.longestSameSuitRun,
      description: 'Most consecutive cards of one suit in this order.',
    },
    {
      label: 'Longest ascending run',
      value: stats.longestAscendingRun,
      description:
        'Most consecutive cards whose ranks strictly increase (suits ignored).',
    },
    {
      label: 'Longest descending run',
      value: stats.longestDescendingRun,
      description:
        'Most consecutive cards whose ranks strictly decrease (suits ignored).',
    },
    {
      label: 'Cards in natural position',
      value: stats.naturalPositionCount,
      description:
        'Cards that sit where they would in a fresh sorted deck (clubs A-K, diamonds A-K, hearts A-K, spades A-K).',
    },
    {
      label: 'Adjacent same-suit pairs',
      value: stats.adjacentSameSuitPairs,
      description:
        'Neighbouring positions where two cards of the same suit sit next to each other.',
    },
    {
      label: 'Inversion count',
      value: stats.inversionCount,
      description:
        'Pairs of cards that are out of order vs. a sorted deck. Higher means more shuffled.',
    },
  ];
}

export function StatsPanel({ stats }: { stats: ShuffleStats }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-3">Stats for this shuffle</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles(stats).map((t) => (
          <div
            key={t.label}
            className="rounded-md border border-zinc-200 p-4 bg-white"
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t.label}
            </div>
            <div className="text-3xl font-semibold tabular-nums mt-1">
              {t.value.toLocaleString()}
            </div>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              {t.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
