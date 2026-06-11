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
