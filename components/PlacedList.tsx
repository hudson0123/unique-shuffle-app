import { CardChip } from './CardChip';
import { cardLabel } from '@/lib/deck';

type Props = {
  placed: number[];
  onRemove: (index: number) => void;
};

export function PlacedList({ placed, onRemove }: Props) {
  return (
    <ol className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-2">
      {Array.from({ length: 52 }).map((_, i) => {
        const card = placed[i];
        return (
          <li
            key={i}
            className="flex items-center gap-3 text-sm"
            aria-label={
              card !== undefined
                ? `Position ${i + 1}: ${cardLabel(card)}`
                : `Position ${i + 1}: empty`
            }
          >
            <span className="w-8 text-right tabular-nums text-zinc-500">
              {i + 1}.
            </span>
            {card !== undefined ? (
              <CardChip
                card={card}
                variant="list"
                ariaLabel={`${cardLabel(card)} at position ${i + 1}, click to remove`}
                onClick={() => onRemove(i)}
              />
            ) : (
              <span className="w-12 h-14 rounded-md border border-dashed border-zinc-300" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
