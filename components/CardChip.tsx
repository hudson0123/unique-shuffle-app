import { decodeCard, RANKS, SUITS } from '@/lib/deck';

type Variant = 'grid' | 'grid-placed' | 'list' | 'slot' | 'strip' | 'match-hit';

type Props = {
  card: number;
  variant?: Variant;
  ariaLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
};

const sizeFor: Record<Variant, string> = {
  grid: 'w-7 h-9 sm:w-12 sm:h-14 lg:w-14 lg:h-16',
  'grid-placed': 'w-7 h-9 sm:w-12 sm:h-14 lg:w-14 lg:h-16',
  list: 'w-10 h-12 sm:w-12 sm:h-14',
  slot: 'w-full h-full',
  strip: 'w-7 h-9 sm:w-8 sm:h-10',
  'match-hit': 'w-7 h-9 sm:w-8 sm:h-10',
};

const rankTextFor: Record<Variant, string> = {
  grid: 'text-[10px] sm:text-sm lg:text-base',
  'grid-placed': 'text-[10px] sm:text-sm lg:text-base',
  list: 'text-xs sm:text-base',
  slot: 'text-xs sm:text-sm',
  strip: 'text-[10px] sm:text-xs',
  'match-hit': 'text-[10px] sm:text-xs',
};

const suitTextFor: Record<Variant, string> = {
  grid: 'text-xs sm:text-base lg:text-lg',
  'grid-placed': 'text-xs sm:text-base lg:text-lg',
  list: 'text-sm sm:text-lg',
  slot: 'text-sm sm:text-base',
  strip: 'text-xs sm:text-sm',
  'match-hit': 'text-xs sm:text-sm',
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
      <span className={`${rankTextFor[variant]} ${color}`}>{rankLabel}</span>
      <span className={`${suitTextFor[variant]} ${color}`}>{suitInfo.symbol}</span>
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
