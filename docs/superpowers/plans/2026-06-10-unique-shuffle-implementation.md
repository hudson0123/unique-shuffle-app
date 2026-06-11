# Unique Shuffle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app where users enter a 52-card deck order via a visual grid, learn whether that exact shuffle has been recorded before, and see computed stats and the closest prior submission.

**Architecture:** Next.js 16 App Router (already scaffolded). Pure helper modules for card encoding, statistics, and closest-match computation (TDD via Vitest). Drizzle ORM against Neon Postgres for two tables (`shuffles`, `rate_limits`). One Server Action for submission; the result page is a React Server Component that reads by hash and computes its panels server-side.

**Tech Stack:** Next.js 16.2.9, React 19.2, Tailwind v4, TypeScript 5, Drizzle ORM, `@neondatabase/serverless`, Vitest, `@electric-sql/pglite` (in-process Postgres for integration tests).

**Spec:** `docs/superpowers/specs/2026-06-10-unique-shuffle-design.md` — read this first; the plan implements it.

**Next.js 16.2.9 note:** Per `AGENTS.md`, this version has breaking changes from common training data. Before writing code that touches Next.js APIs, consult:
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (Server Actions)
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Route Handlers)
- `node_modules/next/dist/docs/01-app/02-guides/forms.md` (Forms)
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md` (`<Form>` component)

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `lib/deck.ts` | Card encoding (0–51), validation, hashing, suit/rank helpers |
| `lib/stats.ts` | Six pure functions computing shuffle statistics |
| `lib/closest.ts` | O(N) closest-match scan returning the best match |
| `lib/placementMachine.ts` | Pure reducer for the input page's placement state |
| `lib/schema.ts` | Drizzle table definitions (`shuffles`, `rate_limits`) |
| `lib/db.ts` | Drizzle client construction |
| `lib/rateLimit.ts` | Postgres-backed per-IP hourly rate limiter |
| `lib/constants.ts` | Pre-formatted 52! string and other constants |
| `app/actions/submit.ts` | `submitShuffle` Server Action |
| `app/result/[hash]/page.tsx` | Result page (RSC) |
| `app/result/[hash]/not-found.tsx` | 404 for unknown hash |
| `components/CardChip.tsx` | One card cell, used in grid, placed list, visual strip |
| `components/CardGrid.tsx` | 4×13 grid of available cards |
| `components/PlacedList.tsx` | Scrollable numbered list of placed cards |
| `components/VisualStrip.tsx` | Compact 52-card strip used on result page |
| `components/StatsPanel.tsx` | Tiles for computed statistics |
| `components/ClosestMatchPanel.tsx` | Nearest prior shuffle display |
| `components/CopyLinkButton.tsx` | Copy-to-clipboard for the permalink |
| `components/VerdictBanner.tsx` | Verdict + rarity framing block |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `drizzle/migrations/0000_initial.sql` | First migration creating both tables |
| `vitest.config.ts` | Vitest configuration |
| `tests/deck.test.ts` | Unit tests for `lib/deck.ts` |
| `tests/stats.test.ts` | Unit tests for `lib/stats.ts` |
| `tests/closest.test.ts` | Unit tests for `lib/closest.ts` |
| `tests/placementMachine.test.ts` | Unit tests for `lib/placementMachine.ts` |
| `tests/integration/submit.test.ts` | End-to-end submit flow against PGlite |
| `tests/integration/db-fixture.ts` | Helper that constructs a Drizzle client over PGlite |
| `.env.example` | Sample env vars for local dev |

**Modified files:**
- `app/page.tsx` — replace boilerplate with the input page (rendered by a client component)
- `app/layout.tsx` — update `metadata.title` / `description`; remove unused styles if any
- `app/globals.css` — light tweaks; mostly unchanged
- `package.json` — add dependencies
- `tsconfig.json` — add `@/*` path alias if not already present
- `README.md` — replace generated content with a brief project description and run instructions

---

## Task 1: Add dependencies and Vitest config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json` (path alias)

- [ ] **Step 1: Install runtime and dev dependencies**

Run from `/Users/Hudson.O'Donnell/Documents/personal/unique-shuffle`:

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit vitest @electric-sql/pglite tsx
```

Expected: dependencies install without error.

- [ ] **Step 2: Add `@/*` path alias in `tsconfig.json`**

Open `tsconfig.json`. The Next.js scaffold typically already includes a `paths` block with `"@/*": ["./*"]`. If it does, no change. If not, add it inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./*"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Add npm scripts to `package.json`**

Inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 5: Verify the test runner starts**

```bash
npx vitest run
```

Expected: Vitest prints "No test files found" and exits 0 (or 1 — both acceptable; the point is it ran). If it errors, fix config.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json
git commit -m "chore: add Drizzle, Neon, Vitest, and PGlite"
```

---

## Task 2: Card encoding helpers (`lib/deck.ts`) — TDD

Cards are integers 0–51. `suit = floor(n / 13)` (0=clubs, 1=diamonds, 2=hearts, 3=spades). `rank = n % 13` (0=Ace … 12=King).

**Files:**
- Create: `lib/deck.ts`
- Create: `tests/deck.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/deck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  encodeCard,
  decodeCard,
  isValidSequence,
  hashSequence,
  cardLabel,
  suitOf,
  rankOf,
  SUITS,
  RANKS,
} from '@/lib/deck';

describe('encodeCard / decodeCard', () => {
  it('encodes (suit, rank) to a single integer in [0, 51]', () => {
    expect(encodeCard(0, 0)).toBe(0); // Ace of clubs
    expect(encodeCard(3, 12)).toBe(51); // King of spades
    expect(encodeCard(2, 5)).toBe(31); // 6 of hearts (2 * 13 + 5)
  });

  it('decodes an integer back to (suit, rank)', () => {
    expect(decodeCard(0)).toEqual({ suit: 0, rank: 0 });
    expect(decodeCard(51)).toEqual({ suit: 3, rank: 12 });
    expect(decodeCard(31)).toEqual({ suit: 2, rank: 5 });
  });

  it('round-trips for every card', () => {
    for (let n = 0; n < 52; n++) {
      const { suit, rank } = decodeCard(n);
      expect(encodeCard(suit, rank)).toBe(n);
    }
  });
});

describe('suitOf / rankOf', () => {
  it('match decodeCard', () => {
    for (let n = 0; n < 52; n++) {
      const d = decodeCard(n);
      expect(suitOf(n)).toBe(d.suit);
      expect(rankOf(n)).toBe(d.rank);
    }
  });
});

describe('SUITS and RANKS', () => {
  it('SUITS has four entries in order ♣ ♦ ♥ ♠', () => {
    expect(SUITS).toHaveLength(4);
    expect(SUITS[0].symbol).toBe('♣');
    expect(SUITS[3].symbol).toBe('♠');
  });

  it('RANKS has 13 entries from A to K', () => {
    expect(RANKS).toHaveLength(13);
    expect(RANKS[0].label).toBe('A');
    expect(RANKS[12].label).toBe('K');
  });
});

describe('cardLabel', () => {
  it('formats a card as "<rank><suit>"', () => {
    expect(cardLabel(0)).toBe('A♣');
    expect(cardLabel(51)).toBe('K♠');
    expect(cardLabel(31)).toBe('6♥');
  });
});

describe('isValidSequence', () => {
  it('returns true for a valid 52-permutation', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(isValidSequence(seq)).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidSequence([0, 1, 2])).toBe(false);
    expect(isValidSequence(new Array(53).fill(0))).toBe(false);
  });

  it('rejects duplicates', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[51] = seq[0];
    expect(isValidSequence(seq)).toBe(false);
  });

  it('rejects values outside [0, 51]', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[0] = 52;
    expect(isValidSequence(seq)).toBe(false);
  });

  it('rejects non-integer values', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[0] = 1.5;
    expect(isValidSequence(seq)).toBe(false);
  });
});

describe('hashSequence', () => {
  it('is deterministic for the same input', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(hashSequence(seq)).toBe(hashSequence(seq));
  });

  it('differs for different sequences', () => {
    const a = Array.from({ length: 52 }, (_, i) => i);
    const b = [...a];
    [b[0], b[1]] = [b[1], b[0]];
    expect(hashSequence(a)).not.toBe(hashSequence(b));
  });

  it('returns a 64-char hex string', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(hashSequence(seq)).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/deck.test.ts
```

Expected: FAIL, "Cannot find module '@/lib/deck'".

- [ ] **Step 3: Implement `lib/deck.ts`**

```typescript
import { createHash } from 'node:crypto';

export const SUITS = [
  { id: 0, symbol: '♣', name: 'clubs', color: 'black' },
  { id: 1, symbol: '♦', name: 'diamonds', color: 'red' },
  { id: 2, symbol: '♥', name: 'hearts', color: 'red' },
  { id: 3, symbol: '♠', name: 'spades', color: 'black' },
] as const;

export const RANKS = [
  { id: 0, label: 'A', name: 'Ace' },
  { id: 1, label: '2', name: 'Two' },
  { id: 2, label: '3', name: 'Three' },
  { id: 3, label: '4', name: 'Four' },
  { id: 4, label: '5', name: 'Five' },
  { id: 5, label: '6', name: 'Six' },
  { id: 6, label: '7', name: 'Seven' },
  { id: 7, label: '8', name: 'Eight' },
  { id: 8, label: '9', name: 'Nine' },
  { id: 9, label: '10', name: 'Ten' },
  { id: 10, label: 'J', name: 'Jack' },
  { id: 11, label: 'Q', name: 'Queen' },
  { id: 12, label: 'K', name: 'King' },
] as const;

export const DECK_SIZE = 52;

export function encodeCard(suit: number, rank: number): number {
  return suit * 13 + rank;
}

export function decodeCard(card: number): { suit: number; rank: number } {
  return { suit: Math.floor(card / 13), rank: card % 13 };
}

export function suitOf(card: number): number {
  return Math.floor(card / 13);
}

export function rankOf(card: number): number {
  return card % 13;
}

export function cardLabel(card: number): string {
  const { suit, rank } = decodeCard(card);
  return `${RANKS[rank].label}${SUITS[suit].symbol}`;
}

export function isValidSequence(seq: unknown): seq is number[] {
  if (!Array.isArray(seq)) return false;
  if (seq.length !== DECK_SIZE) return false;
  const seen = new Set<number>();
  for (const v of seq) {
    if (!Number.isInteger(v)) return false;
    if (v < 0 || v >= DECK_SIZE) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

export function hashSequence(seq: number[]): string {
  return createHash('sha256').update(seq.join(',')).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/deck.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/deck.ts tests/deck.test.ts
git commit -m "feat(deck): card encoding, validation, hashing"
```

---

## Task 3: Shuffle statistics (`lib/stats.ts`) — TDD

Compute the six statistics shown on the result page.

**Files:**
- Create: `lib/stats.ts`
- Create: `tests/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  longestSameSuitRun,
  longestAscendingRun,
  longestDescendingRun,
  naturalPositionCount,
  adjacentSameSuitPairs,
  inversionCount,
  computeAllStats,
  sortedDeck,
} from '@/lib/stats';

const SORTED = Array.from({ length: 52 }, (_, i) => i);

describe('sortedDeck', () => {
  it('returns 0..51 in order', () => {
    expect(sortedDeck()).toEqual(SORTED);
  });
});

describe('longestSameSuitRun', () => {
  it('returns 13 for the sorted deck (all clubs run, then diamonds, etc.)', () => {
    expect(longestSameSuitRun(SORTED)).toBe(13);
  });

  it('returns 1 when no two adjacent cards share a suit', () => {
    // Alternate suits: club, diamond, club, diamond, ...
    const seq: number[] = [];
    for (let i = 0; i < 13; i++) {
      seq.push(i, 13 + i, 26 + i, 39 + i);
    }
    expect(longestSameSuitRun(seq)).toBe(1);
  });
});

describe('longestAscendingRun', () => {
  it('returns 13 for an all-ascending suit run within sorted deck', () => {
    expect(longestAscendingRun(SORTED)).toBe(13);
  });

  it('returns 1 for a strictly descending deck', () => {
    const reversed = [...SORTED].reverse();
    expect(longestAscendingRun(reversed)).toBe(1);
  });

  it('counts based on rank only, regardless of suit', () => {
    // 2 of clubs, 3 of hearts, 4 of spades = ascending run of 3
    const seq = [1, 28, 42, 0, 0, 0]; // ranks 1, 2, 3, ...
    expect(longestAscendingRun(seq.slice(0, 3))).toBe(3);
  });
});

describe('longestDescendingRun', () => {
  it('returns 13 for a fully descending deck', () => {
    const reversed = [...SORTED].reverse();
    expect(longestDescendingRun(reversed)).toBe(13);
  });

  it('returns 1 for a strictly ascending deck', () => {
    expect(longestDescendingRun(SORTED)).toBe(1);
  });
});

describe('naturalPositionCount', () => {
  it('returns 52 for the sorted deck', () => {
    expect(naturalPositionCount(SORTED)).toBe(52);
  });

  it('returns 0 when every card is offset', () => {
    const rotated = [...SORTED.slice(1), SORTED[0]];
    expect(naturalPositionCount(rotated)).toBe(0);
  });

  it('counts only positions where card matches index', () => {
    const seq = [...SORTED];
    [seq[0], seq[1]] = [seq[1], seq[0]];
    expect(naturalPositionCount(seq)).toBe(50);
  });
});

describe('adjacentSameSuitPairs', () => {
  it('returns 48 for the sorted deck (12 same-suit pairs per suit × 4 suits)', () => {
    expect(adjacentSameSuitPairs(SORTED)).toBe(48);
  });

  it('returns 0 when no two adjacent cards share a suit', () => {
    const seq: number[] = [];
    for (let i = 0; i < 13; i++) {
      seq.push(i, 13 + i, 26 + i, 39 + i);
    }
    expect(adjacentSameSuitPairs(seq)).toBe(0);
  });
});

describe('inversionCount', () => {
  it('returns 0 for the sorted deck', () => {
    expect(inversionCount(SORTED)).toBe(0);
  });

  it('returns 52*51/2 = 1326 for the fully reversed deck', () => {
    const reversed = [...SORTED].reverse();
    expect(inversionCount(reversed)).toBe(1326);
  });
});

describe('computeAllStats', () => {
  it('returns all six stats keyed by name', () => {
    const stats = computeAllStats(SORTED);
    expect(stats).toEqual({
      longestSameSuitRun: 13,
      longestAscendingRun: 13,
      longestDescendingRun: 1,
      naturalPositionCount: 52,
      adjacentSameSuitPairs: 48,
      inversionCount: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/stats.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/stats.ts`**

```typescript
import { rankOf, suitOf, DECK_SIZE } from './deck';

export function sortedDeck(): number[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

export function longestSameSuitRun(seq: number[]): number {
  let best = 0;
  let current = 0;
  let prevSuit = -1;
  for (const card of seq) {
    const s = suitOf(card);
    if (s === prevSuit) {
      current += 1;
    } else {
      current = 1;
      prevSuit = s;
    }
    if (current > best) best = current;
  }
  return best;
}

export function longestAscendingRun(seq: number[]): number {
  if (seq.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < seq.length; i++) {
    if (rankOf(seq[i]) > rankOf(seq[i - 1])) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function longestDescendingRun(seq: number[]): number {
  if (seq.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < seq.length; i++) {
    if (rankOf(seq[i]) < rankOf(seq[i - 1])) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function naturalPositionCount(seq: number[]): number {
  let n = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === i) n += 1;
  }
  return n;
}

export function adjacentSameSuitPairs(seq: number[]): number {
  let n = 0;
  for (let i = 1; i < seq.length; i++) {
    if (suitOf(seq[i]) === suitOf(seq[i - 1])) n += 1;
  }
  return n;
}

export function inversionCount(seq: number[]): number {
  let n = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      if (seq[i] > seq[j]) n += 1;
    }
  }
  return n;
}

export type ShuffleStats = {
  longestSameSuitRun: number;
  longestAscendingRun: number;
  longestDescendingRun: number;
  naturalPositionCount: number;
  adjacentSameSuitPairs: number;
  inversionCount: number;
};

export function computeAllStats(seq: number[]): ShuffleStats {
  return {
    longestSameSuitRun: longestSameSuitRun(seq),
    longestAscendingRun: longestAscendingRun(seq),
    longestDescendingRun: longestDescendingRun(seq),
    naturalPositionCount: naturalPositionCount(seq),
    adjacentSameSuitPairs: adjacentSameSuitPairs(seq),
    inversionCount: inversionCount(seq),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/stats.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts tests/stats.test.ts
git commit -m "feat(stats): six shuffle statistics with full tests"
```

---

## Task 4: Closest-match helper (`lib/closest.ts`) — TDD

Pure function over a list of candidate rows. The DB-fetching call site composes this with a query.

**Files:**
- Create: `lib/closest.ts`
- Create: `tests/closest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/closest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findClosestMatch } from '@/lib/closest';

const sorted = Array.from({ length: 52 }, (_, i) => i);

function swap(seq: number[], i: number, j: number): number[] {
  const out = [...seq];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

describe('findClosestMatch', () => {
  it('returns null when there are no candidates', () => {
    expect(findClosestMatch(sorted, [])).toBeNull();
  });

  it('returns the candidate with the most matching positions', () => {
    const oneOff = swap(sorted, 0, 1); // 50 positions match
    const twoOff = swap(swap(sorted, 0, 1), 2, 3); // 48 positions match
    const candidates = [
      { id: 1, sequence: twoOff, createdAt: new Date('2026-06-01') },
      { id: 2, sequence: oneOff, createdAt: new Date('2026-06-02') },
    ];
    const result = findClosestMatch(sorted, candidates);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(2);
    expect(result!.matchCount).toBe(50);
  });

  it('breaks ties by lower id', () => {
    const a = swap(sorted, 0, 1);
    const b = swap(sorted, 2, 3);
    const candidates = [
      { id: 7, sequence: b, createdAt: new Date('2026-06-02') },
      { id: 3, sequence: a, createdAt: new Date('2026-06-01') },
    ];
    const result = findClosestMatch(sorted, candidates);
    expect(result!.id).toBe(3);
  });

  it('reports an exact match as 52', () => {
    const candidates = [
      { id: 1, sequence: [...sorted], createdAt: new Date() },
    ];
    expect(findClosestMatch(sorted, candidates)!.matchCount).toBe(52);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/closest.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/closest.ts`**

```typescript
export type Candidate = {
  id: number;
  sequence: number[];
  createdAt: Date;
};

export type ClosestMatch = {
  id: number;
  createdAt: Date;
  matchCount: number;
  sequence: number[];
};

export function findClosestMatch(
  target: number[],
  candidates: Iterable<Candidate>,
): ClosestMatch | null {
  let best: ClosestMatch | null = null;

  for (const c of candidates) {
    let matches = 0;
    for (let i = 0; i < target.length; i++) {
      if (target[i] === c.sequence[i]) matches += 1;
    }

    if (
      best === null ||
      matches > best.matchCount ||
      (matches === best.matchCount && c.id < best.id)
    ) {
      best = {
        id: c.id,
        createdAt: c.createdAt,
        matchCount: matches,
        sequence: c.sequence,
      };
    }
  }

  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/closest.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/closest.ts tests/closest.test.ts
git commit -m "feat(closest): O(N) closest-match scan helper"
```

---

## Task 5: Placement state machine (`lib/placementMachine.ts`) — TDD

A pure reducer for the input page's state. Reasoning about input UX is much easier with the state machine isolated from React.

**Files:**
- Create: `lib/placementMachine.ts`
- Create: `tests/placementMachine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/placementMachine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  initialPlacement,
  reducePlacement,
  isComplete,
  type PlacementState,
} from '@/lib/placementMachine';

const empty: PlacementState = initialPlacement();

describe('initialPlacement', () => {
  it('starts empty', () => {
    expect(empty.placed).toEqual([]);
  });
});

describe('reducePlacement: PLACE', () => {
  it('appends a card', () => {
    const s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    expect(s.placed).toEqual([5]);
  });

  it('does nothing if the card is already placed', () => {
    const s1 = reducePlacement(empty, { type: 'PLACE', card: 5 });
    const s2 = reducePlacement(s1, { type: 'PLACE', card: 5 });
    expect(s2.placed).toEqual([5]);
  });

  it('does nothing if 52 cards are already placed', () => {
    let s: PlacementState = empty;
    for (let i = 0; i < 52; i++) {
      s = reducePlacement(s, { type: 'PLACE', card: i });
    }
    const overflow = reducePlacement(s, { type: 'PLACE', card: 0 });
    expect(overflow.placed.length).toBe(52);
  });

  it('does nothing if card is out of range', () => {
    expect(reducePlacement(empty, { type: 'PLACE', card: -1 })).toBe(empty);
    expect(reducePlacement(empty, { type: 'PLACE', card: 52 })).toBe(empty);
  });
});

describe('reducePlacement: REMOVE_AT', () => {
  it('removes the card at the given index and shifts following ones', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    s = reducePlacement(s, { type: 'PLACE', card: 3 });
    s = reducePlacement(s, { type: 'REMOVE_AT', index: 1 });
    expect(s.placed).toEqual([5, 3]);
  });

  it('does nothing for an out-of-range index', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    expect(reducePlacement(s, { type: 'REMOVE_AT', index: 7 })).toBe(s);
  });
});

describe('reducePlacement: UNDO', () => {
  it('removes the most recent placement', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    s = reducePlacement(s, { type: 'UNDO' });
    expect(s.placed).toEqual([5]);
  });

  it('is a no-op on empty state', () => {
    expect(reducePlacement(empty, { type: 'UNDO' })).toBe(empty);
  });
});

describe('reducePlacement: CLEAR', () => {
  it('returns to the empty state', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    const cleared = reducePlacement(s, { type: 'CLEAR' });
    expect(cleared.placed).toEqual([]);
  });
});

describe('reducePlacement: HYDRATE', () => {
  it('replaces state with a valid persisted snapshot', () => {
    const s = reducePlacement(empty, { type: 'HYDRATE', placed: [1, 2, 3] });
    expect(s.placed).toEqual([1, 2, 3]);
  });

  it('ignores hydrate with invalid data', () => {
    const s = reducePlacement(empty, {
      type: 'HYDRATE',
      placed: [1, 1] as number[], // duplicate
    });
    expect(s.placed).toEqual([]);
  });
});

describe('isComplete', () => {
  it('returns true only when 52 unique cards are placed', () => {
    let s: PlacementState = empty;
    for (let i = 0; i < 51; i++) {
      s = reducePlacement(s, { type: 'PLACE', card: i });
    }
    expect(isComplete(s)).toBe(false);
    s = reducePlacement(s, { type: 'PLACE', card: 51 });
    expect(isComplete(s)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/placementMachine.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/placementMachine.ts`**

```typescript
import { DECK_SIZE } from './deck';

export type PlacementState = {
  placed: number[];
};

export type PlacementAction =
  | { type: 'PLACE'; card: number }
  | { type: 'REMOVE_AT'; index: number }
  | { type: 'UNDO' }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; placed: number[] };

export function initialPlacement(): PlacementState {
  return { placed: [] };
}

function snapshotIsValid(placed: number[]): boolean {
  if (placed.length > DECK_SIZE) return false;
  const seen = new Set<number>();
  for (const v of placed) {
    if (!Number.isInteger(v)) return false;
    if (v < 0 || v >= DECK_SIZE) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

export function reducePlacement(
  state: PlacementState,
  action: PlacementAction,
): PlacementState {
  switch (action.type) {
    case 'PLACE': {
      if (!Number.isInteger(action.card)) return state;
      if (action.card < 0 || action.card >= DECK_SIZE) return state;
      if (state.placed.length >= DECK_SIZE) return state;
      if (state.placed.includes(action.card)) return state;
      return { placed: [...state.placed, action.card] };
    }
    case 'REMOVE_AT': {
      if (action.index < 0 || action.index >= state.placed.length) return state;
      return {
        placed: state.placed.filter((_, i) => i !== action.index),
      };
    }
    case 'UNDO': {
      if (state.placed.length === 0) return state;
      return { placed: state.placed.slice(0, -1) };
    }
    case 'CLEAR': {
      if (state.placed.length === 0) return state;
      return { placed: [] };
    }
    case 'HYDRATE': {
      if (!snapshotIsValid(action.placed)) return state;
      return { placed: [...action.placed] };
    }
  }
}

export function isComplete(state: PlacementState): boolean {
  return state.placed.length === DECK_SIZE;
}

export function placedSet(state: PlacementState): Set<number> {
  return new Set(state.placed);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/placementMachine.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/placementMachine.ts tests/placementMachine.test.ts
git commit -m "feat(placement): reducer for the input page state machine"
```

---

## Task 6: Drizzle schema & client

**Files:**
- Create: `lib/schema.ts`
- Create: `lib/db.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Create `lib/schema.ts`**

```typescript
import {
  bigserial,
  check,
  inet,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const shuffles = pgTable(
  'shuffles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash').notNull().unique(),
    sequence: smallint('sequence').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sequenceLength: check(
      'sequence_length_52',
      sql`array_length(${table.sequence}, 1) = 52`,
    ),
  }),
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    ip: inet('ip').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ip, table.windowStart] }),
  }),
);

export type Shuffle = typeof shuffles.$inferSelect;
export type NewShuffle = typeof shuffles.$inferInsert;
```

- [ ] **Step 2: Create `lib/db.ts`**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Permissive Drizzle type so library helpers can accept both the
// production (neon-http) and test (pglite) clients without coupling.
export type Db = PgDatabase<any, any, any>;

let cached: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = neon(url);
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
```

- [ ] **Step 3: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
```

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

- [ ] **Step 5: Generate the initial migration**

```bash
npx drizzle-kit generate
```

Expected: A new file appears under `drizzle/migrations/`. Inspect it — it should `CREATE TABLE` both `shuffles` and `rate_limits` with the constraints and primary keys defined above.

- [ ] **Step 6: Commit**

```bash
git add lib/schema.ts lib/db.ts drizzle.config.ts .env.example drizzle/
git commit -m "feat(db): Drizzle schema, client, and initial migration"
```

---

## Task 7: Integration test fixture (`tests/integration/db-fixture.ts`)

Set up an in-process Postgres (PGlite) so submit-flow tests don't need a live Neon connection.

**Files:**
- Create: `tests/integration/db-fixture.ts`

- [ ] **Step 1: Implement the fixture**

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/schema';
import path from 'node:path';

export async function createTestDb() {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../drizzle/migrations'),
  });
  return { db, pg };
}
```

- [ ] **Step 2: Smoke-test the fixture**

Create `tests/integration/fixture.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { shuffles } from '@/lib/schema';

describe('test db fixture', () => {
  it('runs migrations and can insert a row', async () => {
    const { db } = await createTestDb();
    await db.insert(shuffles).values({
      hash: 'deadbeef'.repeat(8),
      sequence: Array.from({ length: 52 }, (_, i) => i),
    });
    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
    expect(rows[0].sequence).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });
});
```

Run:

```bash
npx vitest run tests/integration/fixture.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/db-fixture.ts tests/integration/fixture.test.ts
git commit -m "test: PGlite-backed integration fixture"
```

---

## Task 8: Rate limiter (`lib/rateLimit.ts`) — TDD against the fixture

**Files:**
- Create: `lib/rateLimit.ts`
- Create: `tests/integration/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/rateLimit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { recordAndCheckRateLimit, RateLimitError } from '@/lib/rateLimit';

describe('rate limiter', () => {
  it('allows up to 60 submissions per IP per hour', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
  });

  it('rejects the 61st submission in the same window', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
    await expect(
      recordAndCheckRateLimit(db, '203.0.113.5'),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('tracks separate IPs separately', async () => {
    const { db } = await createTestDb();
    for (let i = 0; i < 60; i++) {
      await recordAndCheckRateLimit(db, '203.0.113.5');
    }
    await recordAndCheckRateLimit(db, '203.0.113.6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/integration/rateLimit.test.ts
```

Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/rateLimit.ts`**

```typescript
import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { rateLimits } from './schema';

export const RATE_LIMIT_PER_HOUR = 60;

export class RateLimitError extends Error {
  constructor() {
    super('Too many submissions, try again later.');
    this.name = 'RateLimitError';
  }
}

export async function recordAndCheckRateLimit(
  db: Db,
  ip: string,
): Promise<void> {
  const result = await db
    .insert(rateLimits)
    .values({
      ip,
      windowStart: sql`date_trunc('hour', now())`,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimits.ip, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const newCount = result[0]?.count ?? 0;
  if (newCount > RATE_LIMIT_PER_HOUR) {
    throw new RateLimitError();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/integration/rateLimit.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/rateLimit.ts tests/integration/rateLimit.test.ts
git commit -m "feat(rateLimit): 60-per-hour-per-IP limiter against Postgres"
```

---

## Task 9: Constants and helpers (`lib/constants.ts`)

**Files:**
- Create: `lib/constants.ts`

- [ ] **Step 1: Implement**

```typescript
// 52! as a decimal string. Pre-formatted to avoid bigint formatting at runtime.
export const FACTORIAL_52 =
  '80,658,175,170,943,878,571,660,636,856,403,766,975,289,505,440,883,277,824,000,000,000,000';

export const RARITY_PARAGRAPH = `A standard 52-card shuffle has ${FACTORIAL_52} possible orderings (52!). Statistically, your shuffle is almost certainly the first time this exact sequence has existed in human history.`;
```

- [ ] **Step 2: Commit**

```bash
git add lib/constants.ts
git commit -m "chore: 52! constant and rarity paragraph"
```

---

## Task 10: `submitShuffle` Server Action

**Files:**
- Create: `app/actions/submit.ts`
- Create: `tests/integration/submit.test.ts`

Before writing this task, the implementer should read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` to confirm the Server Action signature and how to read request headers in Next 16.2.9.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/submit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db-fixture';
import { submitShuffleAgainst } from '@/lib/submitCore';
import { shuffles } from '@/lib/schema';

const sortedSeq = Array.from({ length: 52 }, (_, i) => i);

describe('submitShuffle core', () => {
  it('inserts a new shuffle and returns via=new with the hash', async () => {
    const { db } = await createTestDb();
    const result = await submitShuffleAgainst(db, sortedSeq, '203.0.113.1');
    expect(result.via).toBe('new');
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);

    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
  });

  it('treats a duplicate submission as via=match without inserting a second row', async () => {
    const { db } = await createTestDb();
    await submitShuffleAgainst(db, sortedSeq, '203.0.113.1');
    const result = await submitShuffleAgainst(db, sortedSeq, '203.0.113.2');
    expect(result.via).toBe('match');

    const rows = await db.select().from(shuffles);
    expect(rows).toHaveLength(1);
  });

  it('rejects invalid sequences', async () => {
    const { db } = await createTestDb();
    await expect(
      submitShuffleAgainst(db, [0, 1, 2], '203.0.113.1'),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/integration/submit.test.ts
```

Expected: FAIL, module not found.

- [ ] **Step 3: Create `lib/submitCore.ts`** (extracted from the action so it's testable without Next)

```typescript
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { hashSequence, isValidSequence } from './deck';
import { recordAndCheckRateLimit } from './rateLimit';
import { shuffles } from './schema';

export class InvalidSequenceError extends Error {
  constructor() {
    super('Invalid card sequence.');
    this.name = 'InvalidSequenceError';
  }
}

export type SubmitResult = {
  hash: string;
  via: 'new' | 'match';
};

export async function submitShuffleAgainst(
  db: Db,
  sequence: number[],
  ip: string,
): Promise<SubmitResult> {
  if (!isValidSequence(sequence)) {
    throw new InvalidSequenceError();
  }

  await recordAndCheckRateLimit(db, ip);

  const hash = hashSequence(sequence);

  const inserted = await db
    .insert(shuffles)
    .values({ hash, sequence })
    .onConflictDoNothing({ target: shuffles.hash })
    .returning({ id: shuffles.id });

  if (inserted.length > 0) {
    return { hash, via: 'new' };
  }

  // Match: confirm the row exists. (No need to read it; caller fetches by hash.)
  const existing = await db
    .select({ id: shuffles.id })
    .from(shuffles)
    .where(eq(shuffles.hash, hash))
    .limit(1);

  if (existing.length === 0) {
    // Should be unreachable; the conflict implies a row exists.
    throw new Error('Submission conflicted but row not found');
  }

  return { hash, via: 'match' };
}
```

- [ ] **Step 4: Create the Server Action wrapper `app/actions/submit.ts`**

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/integration/submit.test.ts
```

Expected: all green. (The integration test exercises `submitShuffleAgainst`, the testable core; the Server Action wrapper just adds header reading and redirect.)

- [ ] **Step 6: Commit**

```bash
git add lib/submitCore.ts app/actions/submit.ts tests/integration/submit.test.ts
git commit -m "feat(submit): submitShuffle Server Action + testable core"
```

---

## Task 11: `CardChip` shared component

A single reusable card chip used in three places: the grid, the placed list, the visual strip.

**Files:**
- Create: `components/CardChip.tsx`

- [ ] **Step 1: Implement**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/CardChip.tsx
git commit -m "feat(ui): CardChip shared component"
```

---

## Task 12: `CardGrid` and `PlacedList` components

**Files:**
- Create: `components/CardGrid.tsx`
- Create: `components/PlacedList.tsx`

- [ ] **Step 1: Implement `components/CardGrid.tsx`**

```tsx
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
```

Note: Tailwind v4 generates `grid-cols-N` utilities for arbitrary integers via its dynamic-value system, so `grid-cols-13` works without a theme override. If the JIT for some reason doesn't pick it up after a clean build, replace the class with `style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}`.

- [ ] **Step 2: Implement `components/PlacedList.tsx`**

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add components/CardGrid.tsx components/PlacedList.tsx
git commit -m "feat(ui): CardGrid and PlacedList components"
```

---

## Task 13: Input page (`app/page.tsx`)

Convert the home page into the card input UI. The page itself is a client component that owns the placement state, persists to localStorage, and calls the Server Action on submit.

**Keyboard scope:** This task implements ⌘Z / Ctrl+Z and Backspace for undo. Each grid card is a focusable `<button>`, so Tab + Enter already provides baseline keyboard accessibility. The spec also mentions arrow-key navigation across the grid as a nice-to-have — that's deferred (it adds a non-trivial roving-tabindex implementation and isn't needed for spec-conformant keyboard support).

**Files:**
- Modify: `app/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file with the new content**

```tsx
'use client';

import { useEffect, useReducer, useRef, useState, useTransition } from 'react';
import { CardGrid } from '@/components/CardGrid';
import { PlacedList } from '@/components/PlacedList';
import {
  initialPlacement,
  reducePlacement,
  isComplete,
  placedSet,
  type PlacementState,
} from '@/lib/placementMachine';
import { submitShuffle } from '@/app/actions/submit';

const STORAGE_KEY = 'unique-shuffle:placement-v1';

function loadInitial(): PlacementState {
  if (typeof window === 'undefined') return initialPlacement();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialPlacement();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.placed)) {
      const hydrated = reducePlacement(initialPlacement(), {
        type: 'HYDRATE',
        placed: parsed.placed,
      });
      return hydrated;
    }
  } catch {
    // ignore
  }
  return initialPlacement();
}

export default function Home() {
  const [state, dispatch] = useReducer(reducePlacement, undefined, loadInitial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const wasComplete = useRef(false);

  // Persist on every change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable; ignore
    }
  }, [state]);

  // When completion is first achieved, scroll the Submit button into view
  useEffect(() => {
    if (isComplete(state) && !wasComplete.current) {
      submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      wasComplete.current = true;
    }
    if (!isComplete(state)) wasComplete.current = false;
  }, [state]);

  // ⌘Z / Ctrl+Z undo; Backspace removes the most recently placed card
  // unless an editable element has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if (e.key === 'Backspace' && !isEditable) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSubmit() {
    if (!isComplete(state)) return;
    setError(null);
    startTransition(async () => {
      try {
        await submitShuffle(state.placed);
        // Server action redirects; if we reach here the redirect happened.
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Something went wrong. Please try again.',
        );
      }
    });
  }

  function onClearAll() {
    if (state.placed.length === 0) return;
    const ok = window.confirm('Clear all placed cards?');
    if (ok) dispatch({ type: 'CLEAR' });
  }

  const placedSetRef = placedSet(state);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Unique Shuffle</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Enter the order of your shuffled deck. Tap the cards in the grid in
          the order they appear from the top of your deck. We&rsquo;ll tell you
          whether this exact shuffle has ever been recorded before.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <section aria-label="Card grid" className="flex-1">
          <CardGrid placed={placedSetRef} onPlace={(c) => dispatch({ type: 'PLACE', card: c })} />
        </section>

        <aside aria-label="Placed cards" className="w-full lg:w-80 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {state.placed.length} / 52
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UNDO' })}
                disabled={state.placed.length === 0}
                className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={onClearAll}
                disabled={state.placed.length === 0}
                className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          <button
            ref={submitRef}
            type="button"
            onClick={onSubmit}
            disabled={!isComplete(state) || pending}
            className="w-full mb-4 py-3 rounded-md bg-zinc-900 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Submitting…' : 'Submit shuffle'}
          </button>

          {error && (
            <p className="text-sm text-rose-600 mb-3" role="alert">
              {error}
            </p>
          )}

          <PlacedList
            placed={state.placed}
            onRemove={(i) => dispatch({ type: 'REMOVE_AT', index: i })}
          />
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the dev server compiles**

```bash
npm run dev
```

Then open `http://localhost:3000` in a browser. Expected: input page renders, you can tap cards into the placed list, undo, clear. Submit will fail until a DB is wired — that's expected at this step.

Stop the dev server before continuing.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): input page with placement state and localStorage"
```

---

## Task 14: Result page server component

**Files:**
- Create: `app/result/[hash]/page.tsx`
- Create: `app/result/[hash]/not-found.tsx`
- Create: `components/VerdictBanner.tsx`
- Create: `components/VisualStrip.tsx`
- Create: `components/StatsPanel.tsx`
- Create: `components/ClosestMatchPanel.tsx`
- Create: `components/CopyLinkButton.tsx`

Before this task, the implementer should read `node_modules/next/dist/docs/01-app/01-getting-started/` files on dynamic routes and server components for Next 16.2.9.

- [ ] **Step 1: Create `components/VerdictBanner.tsx`**

```tsx
import { RARITY_PARAGRAPH } from '@/lib/constants';

type Props =
  | { kind: 'new'; submissionNumber: number }
  | { kind: 'match'; originalNumber: number; originalDate: Date }
  | { kind: 'permalink'; submissionNumber: number; recordedDate: Date };

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function VerdictBanner(props: Props) {
  let headline: string;
  let sub: string;

  if (props.kind === 'new') {
    headline = 'Never seen before.';
    sub = `You are the ${props.submissionNumber.toLocaleString()}${ordinalSuffix(
      props.submissionNumber,
    )} shuffle ever recorded.`;
  } else if (props.kind === 'match') {
    headline = 'This exact shuffle has been submitted before.';
    sub = `Originally recorded on ${formatDate(props.originalDate)}, submission #${props.originalNumber.toLocaleString()}.`;
  } else {
    headline = `Shuffle #${props.submissionNumber.toLocaleString()}.`;
    sub = `Recorded on ${formatDate(props.recordedDate)}.`;
  }

  return (
    <section className="mb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{headline}</h1>
      <p className="text-zinc-600 mt-1">{sub}</p>
      <p className="text-sm text-zinc-500 mt-4 leading-relaxed">
        {RARITY_PARAGRAPH}
      </p>
    </section>
  );
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
```

- [ ] **Step 2: Create `components/VisualStrip.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `components/StatsPanel.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `components/ClosestMatchPanel.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `components/CopyLinkButton.tsx`**

```tsx
'use client';

import { useState } from 'react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-100"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
```

- [ ] **Step 6: Create `app/result/[hash]/not-found.tsx`**

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2">Shuffle not found</h1>
      <p className="text-zinc-600 mb-6">
        We couldn&rsquo;t find a shuffle with that hash.
      </p>
      <Link href="/" className="text-zinc-900 underline">
        Submit a new shuffle
      </Link>
    </main>
  );
}
```

- [ ] **Step 7: Create `app/result/[hash]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, ne } from 'drizzle-orm';
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
```

- [ ] **Step 8: Commit**

```bash
git add components/VerdictBanner.tsx components/VisualStrip.tsx components/StatsPanel.tsx components/ClosestMatchPanel.tsx components/CopyLinkButton.tsx app/result/[hash]/page.tsx app/result/[hash]/not-found.tsx
git commit -m "feat(result): result page with verdict, stats, closest match"
```

---

## Task 15: Tidy boilerplate

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

- [ ] **Step 1: Update `app/layout.tsx` metadata**

Replace:

```typescript
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};
```

with:

```typescript
export const metadata: Metadata = {
  title: 'Unique Shuffle',
  description: 'Check whether your 52-card deck order has ever been recorded.',
};
```

- [ ] **Step 2: Replace `README.md`**

```markdown
# Unique Shuffle

A web app that asks: has your specific 52-card shuffle ever been recorded before? (Spoiler: almost certainly not — but the app explains why and tells you what else is interesting about it.)

## Run locally

```bash
npm install
cp .env.example .env.local
# edit .env.local with your Neon DATABASE_URL
npm run db:migrate
npm run dev
```

Then open http://localhost:3000.

## Test

```bash
npm test            # one-shot
npm run test:watch  # watch mode
```

Tests use Vitest. Integration tests run against an in-process Postgres (PGlite) so no live database is needed.

## Layout

- `app/` — Next.js App Router pages and Server Actions
- `components/` — UI components
- `lib/` — pure logic (encoding, stats, closest-match, state machine) and DB plumbing
- `tests/` — unit and integration tests
- `drizzle/` — Drizzle migrations
- `docs/superpowers/` — design spec and implementation plan

## Deployment

Vercel + Neon Postgres. Set `DATABASE_URL` in Vercel project env vars; run `npm run db:migrate` against the production database once after the first deploy.
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx README.md
git commit -m "chore: update metadata and README for the app"
```

---

## Task 16: End-to-end smoke check

**Files:** none (manual verification)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all unit and integration tests pass.

- [ ] **Step 2: Build the app**

```bash
npm run build
```

Expected: build succeeds. If there are TypeScript or Next.js errors, fix them in place and re-run.

- [ ] **Step 3: Manually exercise the dev server**

```bash
npm run dev
```

With a working `DATABASE_URL` in `.env.local`:

1. Visit `http://localhost:3000`. Place 52 cards. Use the grid, the placed list to remove a card, the Undo button, and ⌘Z. Confirm progress saves across a refresh.
2. Click Submit. You should be redirected to `/result/<hash>?via=new` and see the "Never seen before" banner.
3. Copy the link. Open it in a new tab — you should see the neutral "Shuffle #N" banner.
4. Click "Submit another" and submit the same order again. You should land on `/result/<hash>?via=match`.

If any step fails, fix and re-test. There's no commit at the end of this task unless something needed a fix — in which case commit with a message describing what.

---

## Task 17: Deployment notes (no code; capture decisions in repo)

**Files:**
- Create: `docs/superpowers/deployment.md`

- [ ] **Step 1: Write the file**

```markdown
# Deployment

## Vercel

1. Push the repo to GitHub.
2. Import the repo at vercel.com/new. Framework: Next.js (auto-detected).
3. Set `DATABASE_URL` in Project Settings → Environment Variables (production and preview).
4. Deploy.

## Neon

1. Create a Neon project.
2. Copy the connection string (must include `?sslmode=require`).
3. From a local checkout with the same `DATABASE_URL`, run:

   ```bash
   npm run db:migrate
   ```

   This applies `drizzle/migrations/*.sql` to the production database. Repeat after any future migration generation.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/deployment.md
git commit -m "docs: deployment notes for Vercel + Neon"
```

---

## Self-Review

After completing every task, verify:

- All unit tests pass: `npm test`
- The dev server runs: `npm run dev`
- The build succeeds: `npm run build`
- Manual flow (Task 16) works against a live Neon database
- The result page renders correctly for new submissions, matched submissions, and permalink visits
