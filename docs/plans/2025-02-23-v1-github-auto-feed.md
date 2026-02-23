# V1 GitHub-Only Auto Feed — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public, read-only feed of auto-generated activity posts from GitHub commits: anonymous visitors see a global timeline and per-user feeds; users sign in with GitHub, pick one repo to track, and commits appear as daily activity posts via webhook.

**Architecture:** Next.js app in `app/` (sibling to `docs/`) with API routes for GitHub OAuth, webhook, and feed queries. Supabase (Postgres) holds users, tracked repos (projects), and activities; schema managed via Supabase CLI migrations. One repo per user in v1; webhook drives idempotent activity upserts per user+UTC-day.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Supabase (Postgres + CLI migrations), Vercel, GitHub OAuth (NextAuth.js or custom), GitHub Webhooks.

**Spec reference:** `docs/V1-SPEC.md`

---

## Phase 1: Project scaffold and Supabase

### Task 1: Create Next.js app in `app/`

**Files:**
- Create: `app/` (entire Next.js app at repo root level, sibling to `docs/`)

**Step 1: Scaffold Next.js in `app/`**

From repo root:

```bash
cd /Users/robertwells/projects/robiwells/app.build-in-public
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Use defaults where prompted (or accept suggested options). Ensure output is under `app/`.

**Step 2: Verify layout**

Confirm structure: `app/src/app/layout.tsx`, `app/src/app/page.tsx`, `app/package.json`. Root `docs/` and `app/` are siblings.

**Step 3: Commit**

```bash
git add app/
git commit -m "chore: add Next.js app in app/"
```

---

### Task 2: Initialize Supabase and first migration (users)

**Files:**
- Create: `app/supabase/config.toml` (via `supabase init`)
- Create: `app/supabase/migrations/YYYYMMDDHHMMSS_create_users.sql`

**Step 1: Install Supabase CLI (if not present) and init in app**

```bash
cd app
npx supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/`.

**Step 2: Create migration for `users` table**

Create a new migration file (use timestamp prefix, e.g. `20250223120000_create_users.sql`):

```sql
-- supabase/migrations/20250223120000_create_users.sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null unique,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_github_id on public.users(github_id);
create index if not exists idx_users_username on public.users(username);

alter table public.users enable row level security;

create policy "Users are viewable by everyone"
  on public.users for select
  using (true);
create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);
-- insert will be done by service role / API (no auth.uid() in v1 for server-side upsert)
```

(Adjust RLS as needed once you use Supabase Auth; for v1, API routes may use service role to upsert users.)

**Step 3: Run migration locally (optional, requires Docker)**

```bash
npx supabase start
npx supabase db reset
```

If Docker is not available, skip and rely on remote `supabase db push` later.

**Step 4: Commit**

```bash
git add app/supabase/
git commit -m "feat(db): add users table migration"
```

---

### Task 3: Migration for projects (tracked_repos)

**Files:**
- Create: `app/supabase/migrations/20250223120100_create_projects.sql`

**Step 1: Add projects table**

```sql
-- supabase/migrations/20250223120100_create_projects.sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  repo_full_name text not null,
  repo_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_projects_user_id on public.projects(user_id);

alter table public.projects enable row level security;

create policy "Projects are viewable by everyone"
  on public.projects for select using (true);
```

**Step 2: Commit**

```bash
git add app/supabase/migrations/
git commit -m "feat(db): add projects (tracked_repos) table migration"
```

---

### Task 4: Migration for activities

**Files:**
- Create: `app/supabase/migrations/20250223120200_create_activities.sql`

**Step 1: Add activities table**

```sql
-- supabase/migrations/20250223120200_create_activities.sql
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  date_utc date not null,
  commit_count int not null default 0,
  first_commit_at timestamptz,
  last_commit_at timestamptz,
  github_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date_utc)
);

create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_last_commit_at on public.activities(last_commit_at desc);
create index if not exists idx_activities_date_utc on public.activities(date_utc desc);

alter table public.activities enable row level security;

create policy "Activities are viewable by everyone"
  on public.activities for select using (true);
```

**Step 2: Commit**

```bash
git add app/supabase/migrations/
git commit -m "feat(db): add activities table migration"
```

---

## Phase 2: GitHub OAuth and user upsert

### Task 5: GitHub OAuth env and dependency

**Files:**
- Modify: `app/.env.local.example` (create if missing)
- Modify: `app/package.json` (add NextAuth or oauth deps)

**Step 1: Add NextAuth and adapter**

```bash
cd app && npm install next-auth@beta @auth/supabase-adapter
```

(Use `next-auth@beta` for App Router support, or current stable if you use Route Handlers manually.)

**Step 2: Document env vars**

Create or update `app/.env.local.example`:

```
# GitHub OAuth (create app at https://github.com/settings/developers)
GITHUB_ID=
GITHUB_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=  # generate with: openssl rand -base64 32

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**Step 3: Commit**

```bash
git add app/package.json app/.env.local.example
git commit -m "chore: add NextAuth and Supabase env example"
```

---

### Task 6: NextAuth API route and GitHub provider

**Files:**
- Create: `app/src/app/api/auth/[...nextauth]/route.ts`
- Create: `app/src/lib/auth.ts` (config + callbacks)

**Step 1: Auth config**

Implement `app/src/lib/auth.ts` with GitHub provider and callbacks that create/update `users` in Supabase (using service role client). On sign-in: upsert by `github_id`; set `username`, `avatar_url`, `updated_at`.

**Step 2: Route handler**

Implement `app/src/app/api/auth/[...nextauth]/route.ts` exporting GET/POST handlers with `NextAuth(authOptions)`.

**Step 3: Session strategy**

Use JWT strategy for v1 (no DB session table required). Include `userId` (Supabase user id) and `username` in token.

**Step 4: Commit**

```bash
git add app/src/app/api/auth/ app/src/lib/auth.ts
git commit -m "feat(auth): GitHub OAuth with NextAuth and user upsert"
```

---

### Task 7: Sign-in button and redirect after login

**Files:**
- Modify: `app/src/app/page.tsx` (or layout)
- Create or modify: `app/src/app/layout.tsx`

**Step 1: Add “Sign in with GitHub”**

On the home page (or a shared header), add a button/link that triggers `signIn("github")`. Use `getServerSession` in server components or `useSession` in client component to show “Sign in” vs “Signed in as …”.

**Step 2: Redirect after login**

In auth callbacks, set redirect to `/onboarding` for new users (no project yet) and to `/u/:username` for users who already have a project. You can detect “new user” by absence of a row in `projects` for that user.

**Step 3: Commit**

```bash
git add app/src/app/
git commit -m "feat(auth): sign-in button and post-login redirect"
```

---

## Phase 3: Onboarding and repo selection

### Task 8: Fetch user’s GitHub repos (API)

**Files:**
- Create: `app/src/app/api/repos/route.ts`

**Step 1: Implement GET /api/repos**

Require session. Use GitHub API `GET /user/repos` with the user’s OAuth access token (from the provider’s account). Return list of public repos (name, full_name, html_url, etc.) for the onboarding UI.

**Step 2: Commit**

```bash
git add app/src/app/api/repos/route.ts
git commit -m "feat(api): GET /api/repos for GitHub repo list"
```

---

### Task 9: Onboarding page and repo selection

**Files:**
- Create: `app/src/app/onboarding/page.tsx`
- Create: `app/src/app/api/onboarding/route.ts` (or use existing pattern)

**Step 1: Onboarding page**

If no session, redirect to sign-in. If session and user already has a project, redirect to `/u/:username`. Otherwise show list (or search) of repos from `/api/repos`, single selection, submit to API.

**Step 2: POST create project**

Endpoint (e.g. POST `/api/onboarding` or POST `/api/projects`): body `{ repo_full_name, repo_url }`. Insert into `projects` for current user; set previous project inactive if you allow multiple later, or just insert one row (unique user_id). Redirect to `/u/:username` on success.

**Step 3: Commit**

```bash
git add app/src/app/onboarding/ app/src/app/api/
git commit -m "feat: onboarding page and repo selection"
```

---

## Phase 4: GitHub webhook and activity upsert

### Task 10: Webhook secret and endpoint skeleton

**Files:**
- Modify: `app/.env.local.example` (add `GITHUB_WEBHOOK_SECRET`)
- Create: `app/src/app/api/webhooks/github/route.ts`

**Step 1: Webhook secret**

Add `GITHUB_WEBHOOK_SECRET` to `.env.local.example`. Document that user creates a GitHub webhook for “push” events pointing to `https://<host>/api/webhooks/github` and sets this secret.

**Step 2: POST handler and signature verification**

Implement POST handler: read raw body, verify `X-Hub-Signature-256` using `GITHUB_WEBHOOK_SECRET`, return 401 if invalid. Parse JSON body, return 200 quickly (respond before heavy work).

**Step 3: Commit**

```bash
git add app/.env.local.example app/src/app/api/webhooks/github/route.ts
git commit -m "feat(webhook): GitHub webhook endpoint with signature verification"
```

---

### Task 11: Webhook payload handling and idempotent activity upsert

**Files:**
- Modify: `app/src/app/api/webhooks/github/route.ts`
- Create: `app/src/lib/activity.ts` (or `app/src/lib/webhook.ts`)

**Step 1: Resolve user and project**

From webhook payload: `repository.full_name`. Look up `projects` by `repo_full_name` and get `user_id`. If no project found, log and return 200 (no-op).

**Step 2: Compute date_utc and commit stats**

From push event: use commit timestamps to determine UTC date(s). For v1, aggregate all commits in the push into the relevant UTC day(s). Compute `commit_count`, `first_commit_at`, `last_commit_at`, and a `github_link` (e.g. compare or latest commit URL).

**Step 3: Upsert activity**

For each (user_id, date_utc) pair: upsert into `activities` (ON CONFLICT (user_id, date_utc) DO UPDATE set commit_count, first_commit_at, last_commit_at, github_link, updated_at). Use Supabase client with service role.

**Step 4: Commit**

```bash
git add app/src/app/api/webhooks/github/route.ts app/src/lib/
git commit -m "feat(webhook): idempotent activity upsert from push events"
```

---

## Phase 5: Feeds

### Task 12: Global feed API

**Files:**
- Create: `app/src/app/api/feed/route.ts`

**Step 1: GET /api/feed**

Query `activities` joined with `users` and `projects`. Order by `last_commit_at` desc. Support optional `?limit=` and `?cursor=` (e.g. last_commit_at) for “Load more”. Return JSON: list of { user, project, activity }.

**Step 2: Commit**

```bash
git add app/src/app/api/feed/route.ts
git commit -m "feat(api): global feed endpoint"
```

---

### Task 13: Global feed page (/)

**Files:**
- Modify: `app/src/app/page.tsx`

**Step 1: Fetch and render feed**

Call `/api/feed` (or use server component and Supabase client). Render list: avatar, username, repo name, commit count, relative time, UTC date, link to GitHub. Include “Sign in with GitHub” and “Load more” if applicable.

**Step 2: Commit**

```bash
git add app/src/app/page.tsx
git commit -m "feat: global feed page"
```

---

### Task 14: User feed API

**Files:**
- Create: `app/src/app/api/feed/u/[username]/route.ts`

**Step 1: GET /api/feed/u/[username]**

Resolve user by `username`, then query `activities` for that user_id joined with project. Order by `last_commit_at` desc. Pagination optional. Return 404 if user not found.

**Step 2: Commit**

```bash
git add app/src/app/api/feed/
git commit -m "feat(api): per-user feed endpoint"
```

---

### Task 15: User profile page (/u/[username])

**Files:**
- Create: `app/src/app/u/[username]/page.tsx`

**Step 1: Fetch and render user feed**

Call `/api/feed/u/[username]` (or server-side Supabase). Show header: avatar, username, optional current repo name. List activity items same as global feed. 404 if user missing.

**Step 2: Commit**

```bash
git add app/src/app/u/
git commit -m "feat: user profile feed page"
```

---

## Phase 6: Settings (view/change tracked repo)

### Task 16: Settings API and page

**Files:**
- Create: `app/src/app/api/settings/project/route.ts` (GET + PATCH or PUT)
- Create: `app/src/app/settings/page.tsx`

**Step 1: GET current project**

Require session. Return current user’s active project (repo_full_name, repo_url).

**Step 2: PATCH/PUT to change project**

Body: `{ repo_full_name, repo_url }`. Update `projects` for current user (or deactivate old and insert new). Return updated project.

**Step 3: Settings page**

Authenticated only; show current repo and a form (or link to repo picker) to change tracked repo. Reuse repo list from onboarding or `/api/repos`.

**Step 4: Commit**

```bash
git add app/src/app/settings/ app/src/app/api/settings/
git commit -m "feat: settings page to view/change tracked repo"
```

---

## Phase 7: Polish and deploy

### Task 17: Link profile from global feed and nav

**Files:**
- Modify: `app/src/app/page.tsx` (and any shared layout/header)

**Step 1: Add links**

In global feed items, link username to `/u/:username`. In header/nav, add “My profile” (to `/u/:username`) and “Settings” when signed in.

**Step 2: Commit**

```bash
git add app/src/app/
git commit -m "feat: profile and settings links in nav and feed"
```

---

### Task 18: Vercel and Supabase project setup (docs only or script)

**Files:**
- Create: `docs/DEPLOY.md` (or add to README)

**Step 1: Document deployment**

Steps: create Vercel project from `app/` (or root with root directory `app`), add env vars (GitHub OAuth, NextAuth, Supabase, webhook secret). Create Supabase project, run migrations with `supabase db push` or link and push. Configure GitHub webhook URL to production `/api/webhooks/github`.

**Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: Vercel and Supabase deployment"
```

---

### Task 19: Manual smoke test and success criteria

**Checklist (from V1-SPEC §6):**

- Sign in with GitHub.
- Choose a repo to track (onboarding).
- Push commits on different days (or simulate webhook).
- Visit `/` and see those days as activity posts.
- Share `/u/:username` and confirm history visible.
- Idempotent: multiple pushes same day update one activity row.
- At least one other user can sign up and track a repo without schema changes.

**Step 1: Run through checklist**

Execute in order; fix any bugs as separate commits.

**Step 2: Commit any final fixes**

```bash
git add -A && git status
git commit -m "fix: smoke test fixes for v1"
```

---

## Execution summary

| Phase | Tasks   | Description                          |
|-------|---------|--------------------------------------|
| 1     | 1–4     | Next.js in `app/`, Supabase migrations (users, projects, activities) |
| 2     | 5–7     | GitHub OAuth, user upsert, sign-in UI and redirects |
| 3     | 8–9     | Onboarding and repo selection        |
| 4     | 10–11   | Webhook endpoint and idempotent activity upsert |
| 5     | 12–15   | Global and per-user feed API and pages |
| 6     | 16      | Settings (view/change tracked repo)  |
| 7     | 17–19   | Nav links, deploy docs, smoke test   |

Total: 19 tasks. Use @superpowers:executing-plans (or @superpowers:subagent-driven-development) to run task-by-task with checkpoints.
