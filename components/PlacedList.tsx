import { CardChip } from './CardChip';
import { cardLabel } from '@/lib/deck';

type Props = {
  placed: number[];
  onRemove: (index: number) => void;
};

export function PlacedList({ placed, onRemove }: Props) {
  return (
    <ol
      className="grid grid-cols-7 sm:grid-cols-6 gap-1.5 max-h-[60vh] overflow-y-auto pr-1"
      aria-label="Placed cards"
    >
      {Array.from({ length: 52 }).map((_, i) => {
        const card = placed[i];
        return (
          <li key={i} className="aspect-[3/4]">
            {card !== undefined ? (
              <CardChip
                card={card}
                variant="slot"
                ariaLabel={`${cardLabel(card)} at position ${i + 1}, click to remove`}
                onClick={() => onRemove(i)}
              />
            ) : (
              <div
                aria-label={`Position ${i + 1}: empty`}
                className="w-full h-full rounded-md border border-dashed border-zinc-300 flex items-center justify-center text-xs text-zinc-400 tabular-nums"
              >
                {i + 1}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
