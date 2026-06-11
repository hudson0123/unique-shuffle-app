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
