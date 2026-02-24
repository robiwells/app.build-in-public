# 5 Minutes a Day — App

Next.js app (NextAuth, Supabase) for the Build in Public product. Run from this directory.

## Getting Started

1. **Environment variables** — Copy `.env.local.example` to `.env.local` and fill in values. Required vars (Supabase, NextAuth, optional GitHub App) are listed in [DEPLOY.md](DEPLOY.md).

2. **Development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

3. **Database** — Migrations live in `supabase/migrations/`. Apply via Supabase CLI or the Supabase SQL editor (see [DEPLOY.md](DEPLOY.md)).

Main entry: `src/app/page.tsx`. The app uses [Geist](https://vercel.com/font) via `next/font`.

## Deploy

Vercel + Supabase. See [DEPLOY.md](DEPLOY.md) for env vars, GitHub OAuth, and GitHub App setup.

## Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
