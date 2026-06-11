# Unique Shuffle — Design Spec

**Date:** 2026-06-10
**Status:** Approved, ready for implementation plan

## Purpose

A public web app where any visitor can input the order of a standard 52-card deck and learn whether that exact shuffle has ever been submitted before. Because 52! ≈ 8.07 × 10⁶⁷, exact matches are statistically impossible — the app's interest lives in framing that rarity and presenting interesting facts about each shuffle (computed stats, nearest prior submission).

## Scope

**In scope (v1):**
- Single shared global submission history (no accounts, fully anonymous, timestamp recorded)
- Visual card-grid input UI for entering 52 cards in order
- Exact-match check against all prior submissions
- Result page with: match verdict + rarity framing, computed shuffle stats, closest prior match, shareable permalink
- Light rate limiting

**Out of scope (v1):**
- User accounts, nicknames, auth
- Generated share-card images (URL share only)
- Leaderboards / aggregate pages built from stats
- Mobile app (mobile web only, via responsive design)

## Audience & storage decisions

| Decision | Choice |
|---|---|
| Audience | Public, shared globally — anyone on the internet |
| Identity | Anonymous; submissions store a timestamp only |
| Input UX | Visual 52-card grid |
| Result emphasis | Verdict + rarity + computed stats + closest match + permalink |
| Hosting | Vercel + Neon Postgres |
| Data model approach | Hash + raw sequence in one row, stats computed on demand (Approach A) |

## Tech stack

- Next.js 16.2.9 (App Router) — already scaffolded
- React 19, Tailwind v4 — already scaffolded
- TypeScript
- Drizzle ORM against Neon Postgres (`@neondatabase/serverless` driver)
- Server Actions for the submit mutation
- Deployment: Vercel + Neon

**Important:** Next.js 16.2.9 has breaking changes from common training data. Per `AGENTS.md`, the implementer must consult `node_modules/next/dist/docs/` before writing code that uses Next.js APIs.

## Architecture

### Pages
- `/` — input page (client component, the card grid)
- `/result/[hash]` — result page (React Server Component)

### Optional route handlers
- `GET /api/shuffles/[hash]` — JSON endpoint for the result data, used by share/copy and future integrations

### Module layout

```
app/
  page.tsx                       ← input grid (client component)
  result/[hash]/page.tsx         ← result page (RSC)
  actions/submit.ts              ← server action `submitShuffle`
  api/shuffles/[hash]/route.ts   ← optional JSON endpoint
lib/
  deck.ts                        ← card encoding, validation, hashing
  stats.ts                       ← shuffle statistics
  closest.ts                     ← closest-match scan
  db.ts                          ← Drizzle client
  schema.ts                      ← Drizzle table definitions
  rateLimit.ts                   ← Postgres-backed IP rate limiter
drizzle/
  migrations/...
```

Each module has a single clear purpose. `deck.ts`, `stats.ts`, and `closest.ts` are pure functions that take a `sequence: number[]` and return data — fully unit-testable without a database.

## Data model

### `shuffles` table

| column | type | constraint | notes |
|---|---|---|---|
| `id` | `bigserial` | PK | submission number; displayed as "Shuffle #1234" |
| `hash` | `text` | UNIQUE NOT NULL | SHA-256 hex of canonical sequence string; primary lookup key |
| `sequence` | `smallint[]` | NOT NULL, length-checked = 52, all values 0–51, all unique | the deck order |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | submission timestamp |

**Index:** unique on `hash` (this is the lookup path for exact-match).

**Length and uniqueness invariants** on `sequence` are enforced by:
- Application-level validation in `lib/deck.ts` (server-side, mirror of client check) — this is the source of truth
- A DB CHECK constraint `array_length(sequence, 1) = 52` as a backstop
- Per-element range and uniqueness checks are application-only — implementing them as DB CHECKs in Postgres requires a custom function and the app-level validator already covers it before any insert

### `rate_limits` table

| column | type | constraint | notes |
|---|---|---|---|
| `ip` | `inet` | PK part 1 | client IP from `x-forwarded-for` |
| `window_start` | `timestamptz` | PK part 2 | start of the current bucket |
| `count` | `int` | NOT NULL | submissions seen in this window |

Policy: 10 submissions per IP per hour. Window granularity is 1 hour; we keep at most one row per (ip, window_start). Rows older than 24 hours are eligible for cleanup (cron or lazy delete on write).

### Canonical card encoding

Cards are integers 0–51:
- `suit = floor(n / 13)` where 0=clubs, 1=diamonds, 2=hearts, 3=spades
- `rank = n % 13` where 0=Ace, 1=2, …, 10=Jack, 11=Queen, 12=King

The hash input is the 52 integers comma-joined as ASCII (e.g., `"0,13,26,..."`). Deterministic and compact.

## Input page UX

**Layout** — desktop two-column, collapses to stacked on mobile:

- **Left: 52-card grid.** 4 rows × 13 columns. Rows by suit in order ♣ ♦ ♥ ♠. Columns by rank A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K. Red suits rendered red; black suits neutral. Each cell is a button (`<button>` element) showing rank + suit symbol.
- **Right: placed list.** Scrollable numbered list, slots 1–52. Top of the panel shows a `12 / 52` progress chip and the primary **Submit** button (disabled until 52 placed).

**Interactions**
- Tap a card in the grid → appended to placed list; the grid cell goes to a faded "used" state and becomes non-clickable.
- Tap a card in the placed list → that card is removed from the list, items after it shift up, the card returns to the grid as available. (Rationale: lets users fix middle-of-deck mistakes without restarting.)
- **Undo** button reverses the most recent placement. Keyboard: `⌘Z` / `Ctrl+Z`.
- **Clear all** button with a confirmation prompt wipes the placed list.
- No "next card" highlight on the grid — every remaining card is equally valid; the deck order is the user's data, not the app's.

**Feedback**
- After placing card 52, the page auto-scrolls to the Submit button and applies a one-time subtle pulse animation.
- Submit button has a loading state during the server action.

**State persistence**
- The placed list lives in `localStorage` keyed by a per-tab session id, so accidental refresh doesn't lose progress. On successful submit, the entry is cleared.

**Accessibility**
- Each card chip is a `<button>` with an `aria-label` such as `"Ace of spades, available"` or `"Ace of spades, placed at position 12"`.
- Keyboard navigation: arrow keys move focus across the grid; Enter places the focused card; Backspace removes the most recently placed card.

**Validation (client)**
- Submit button is disabled unless the placed list has length 52 and all values are unique (the UI naturally guarantees this — the grid prevents double-clicks — but the assertion is held explicitly before the server action call).

## Submit flow

Server Action `submitShuffle(sequence: number[]): Promise<{ hash: string; via: 'new' | 'match' }>`:

1. **Validate.** Reject if `sequence.length !== 52`, any value is outside [0, 51], or duplicates exist. Throw a typed error.
2. **Rate limit.** Increment the (ip, current-hour window) row; if `count > 10`, throw a rate-limit error.
3. **Hash.** `hash = sha256(sequence.join(','))` → 64-char hex.
4. **Insert.** `INSERT INTO shuffles (hash, sequence) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING RETURNING id, created_at`.
5. **Resolve.**
   - If RETURNING returned a row → `via = 'new'`.
   - If empty → SELECT the existing row by hash; this submission matched the original → `via = 'match'`.
6. **Return `{ hash, via }`** to the client; client navigates to `/result/<hash>?via=<via>`.

The result page reads the row server-side and computes stats and closest match in the RSC render.

### Concurrency

Two clients submitting the same exact sequence simultaneously: the unique constraint on `hash` ensures exactly one row is created. Whichever loses the race sees an empty RETURNING and falls through to the SELECT branch, where the row is now present. This is the desired behavior — the second submitter is told their shuffle matched.

## Result page (`/result/[hash]`)

Top-to-bottom sections:

### 1. Verdict banner

The submit redirect adds a query param indicating the origin: `/result/<hash>?via=new` or `/result/<hash>?via=match`. The result page reads it and chooses copy accordingly. If the param is absent (a permalink visit), the page renders the neutral framing.

- **`via=new`** — "**Never seen before.**" Sub-line: "You are the *N*th shuffle ever recorded."
- **`via=match`** — "**This exact shuffle has been submitted before.**" Sub-line: "Originally recorded on *date*, submission #*N*."
- **no param (permalink)** — "**Shuffle #*N*.**" Sub-line: "Recorded on *date*."

### 2. Rarity framing
Single short paragraph with the 52! constant pre-computed as a string literal in code:
> A standard 52-card shuffle has 80,658,175,170,943,878,571,660,636,856,403,766,975,289,505,440,883,277,824,000,000,000,000 possible orderings (52!). Statistically, your shuffle is almost certainly the first time this exact sequence has existed in human history.

### 3. Visual strip
The 52 cards rendered in order in a compact horizontal strip. Each card shows rank + suit symbol on a small chip.

### 4. Computed stats panel
Server-computed at request time from `lib/stats.ts`:
- Longest run of consecutive same-suit cards
- Longest ascending rank run (regardless of suit; Aces low)
- Longest descending rank run
- Number of "natural-position" cards (cards in the slot they would occupy in a fresh sorted deck: positions 0–12 are clubs A–K, 13–25 are diamonds A–K, 26–38 hearts A–K, 39–51 spades A–K)
- Number of adjacent same-suit pairs
- Inversion count vs. sorted (one number summarizing "shuffledness")

Each stat is displayed as a labeled tile with a single-sentence definition under the number.

### 5. Closest prior match
Result of `lib/closest.ts`: an O(N) scan of all other rows computing Hamming distance (number of positions where the two sequences differ). The top match is shown as:
> *X*/52 cards in the same position as **Shuffle #*Y*** (submitted *date*).

Below the headline, the matching positions are visualized inline against the visual strip from section 3.

If the shuffles table contains only the current row (i.e., this is the very first shuffle ever submitted), the section displays a one-liner: "No other shuffles to compare against yet — you're the first."

### 6. Permalink
A "Copy link" button that places the current URL on the clipboard. Plain `https://<host>/result/<hash>`.

### 7. CTA
"Submit another" button linking back to `/`.

## Closest-match implementation note

`lib/closest.ts` exposes `findClosestMatch(targetHash, targetSequence)` that:
1. Streams `SELECT id, sequence, created_at FROM shuffles WHERE hash != $1`
2. Computes Hamming distance (count of positions where `targetSequence[i] !== row.sequence[i]`) for each row
3. Tracks the row with the smallest distance (ties broken by lower `id`)
4. Returns `{ id, created_at, matchCount, sequence } | null`

For v1's expected row counts (low thousands at most), the scan-in-app approach is comfortably fast. The interface is shaped so the function body can be swapped for a denormalized-table or precomputed-index implementation later without changing callers.

## Rate limiting

Postgres-backed limiter in `lib/rateLimit.ts`:
- IP is read from `x-forwarded-for` header (Vercel sets this).
- Window: 1 hour, bucketed to the start of the current hour (`date_trunc('hour', now())`).
- Policy: max 10 submissions per IP per window.
- Implementation: `INSERT INTO rate_limits (ip, window_start, count) VALUES ($1, $2, 1) ON CONFLICT (ip, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`. If returned count > 10, the limiter throws.
- Cleanup: a small lazy-delete on every write removes rows older than 24 hours for that IP.

If the limiter throws, the server action surfaces a friendly "Too many submissions, try again later" message; the client renders it inline above the Submit button.

## Error handling

- **Validation errors** (invalid sequence): impossible from the legitimate UI, but the server action still validates and returns a typed error. The UI logs an unexpected-state error and reloads.
- **Rate-limit errors**: shown inline above Submit.
- **Database errors**: surface a generic "Something went wrong, please try again" toast; do not leak DB messages.
- **Result page, hash not found**: render a 404 page with a link back to `/`.

## Testing strategy

Unit tests (Vitest) for the pure modules:
- `lib/deck.ts` — encoding, decoding, validation, hashing determinism, edge cases (duplicates, out-of-range, wrong length)
- `lib/stats.ts` — each stat function against fixture sequences with known expected outputs (sorted deck, fully reversed deck, several hand-constructed examples)
- `lib/closest.ts` — Hamming distance correctness, tie-breaking, empty-database case

Integration tests for the submit flow against a test database (Neon branch or local Postgres in CI):
- Fresh submit → row appears, hash matches
- Duplicate submit → second submit sees `matched: true`, no second row created
- Concurrent identical submits → exactly one row created
- Rate limit → 11th submit in the same hour from the same IP is rejected

UI is exercised by hand for v1; explicit E2E tests are deferred.

## Open questions / deferred items

- Image share cards (Open Graph image) — deferred to v2
- A leaderboards/explore page over computed stats — deferred to v2
- Closest-match optimization for high row counts — deferred until needed
- Pruning very old `rate_limits` rows beyond the lazy-delete — deferred

## Implementation notes for next stage

- Drizzle migrations live under `drizzle/migrations/`; the first migration creates `shuffles` and `rate_limits`.
- Environment variables: `DATABASE_URL` (Neon connection string). Local dev uses a Neon dev branch.
- Pre-implementation: read `node_modules/next/dist/docs/` sections relevant to Server Actions, route handlers, and the App Router before writing any Next.js-touching code. The version in this repo has breaking changes from the documentation commonly seen in training data.
