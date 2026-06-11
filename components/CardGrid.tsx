import { CardChip } from './CardChip';
import { cardLabel, RANKS, SUITS, encodeCard } from '@/lib/deck';

type Props = {
  placed: Set<number>;
  onPlace: (card: number) => void;
};

export function CardGrid({ placed, onPlace }: Props) {
  return (
    <div className="inline-grid grid-cols-13 gap-1.5">
      {SUITS.map((suit) =>
        RANKS.map((rank) => {
          const card = encodeCard(suit.id, rank.id);
          const isPlaced = placed.has(card);
          return (
            <CardChip
              key={card}
              card={card}
              variant={isPlaced ? 'grid-placed' : 'grid'}
              ariaLabel={`${cardLabel(card)}, ${isPlaced ? 'placed' : 'available'}`}
              onClick={isPlaced ? undefined : () => onPlace(card)}
              disabled={isPlaced}
            />
          );
        }),
      )}
    </div>
  );
}
