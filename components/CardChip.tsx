import { decodeCard, RANKS, SUITS } from '@/lib/deck';

type Variant = 'grid' | 'grid-placed' | 'list' | 'strip' | 'match-hit';

type Props = {
  card: number;
  variant?: Variant;
  ariaLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
};

const sizeFor: Record<Variant, string> = {
  grid: 'w-14 h-16',
  'grid-placed': 'w-14 h-16',
  list: 'w-12 h-14',
  strip: 'w-8 h-10',
  'match-hit': 'w-8 h-10',
};

export function CardChip({
  card,
  variant = 'grid',
  ariaLabel,
  onClick,
  disabled,
}: Props) {
  const { suit, rank } = decodeCard(card);
  const suitInfo = SUITS[suit];
  const rankLabel = RANKS[rank].label;
  const color = suitInfo.color === 'red' ? 'text-rose-600' : 'text-zinc-900';

  const base =
    'flex flex-col items-center justify-center rounded-md border border-zinc-200 bg-white font-mono leading-none select-none';
  const interactive =
    'hover:bg-zinc-100 active:scale-[0.97] transition-transform';
  const placed = 'opacity-25 cursor-not-allowed';
  const hit = 'ring-2 ring-emerald-400';

  const variantClass =
    variant === 'grid-placed'
      ? placed
      : variant === 'match-hit'
        ? hit
        : onClick
          ? interactive
          : '';

  const content = (
    <>
      <span className={`text-base ${color}`}>{rankLabel}</span>
      <span className={`text-lg ${color}`}>{suitInfo.symbol}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`${base} ${sizeFor[variant]} ${variantClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`${base} ${sizeFor[variant]} ${variantClass}`}
    >
      {content}
    </span>
  );
}
