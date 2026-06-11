import { CardChip } from './CardChip';
import { cardLabel } from '@/lib/deck';

type Props = {
  sequence: number[];
  highlightIndexes?: Set<number>;
};

export function VisualStrip({ sequence, highlightIndexes }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {sequence.map((card, i) => (
        <CardChip
          key={i}
          card={card}
          variant={highlightIndexes?.has(i) ? 'match-hit' : 'strip'}
          ariaLabel={`Position ${i + 1}: ${cardLabel(card)}`}
        />
      ))}
    </div>
  );
}
