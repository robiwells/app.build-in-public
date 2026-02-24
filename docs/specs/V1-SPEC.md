To add:
- publishable key and secrey key for supabase, anon is legacy

# V1 Spec: GitHub-Only Auto Feed

This document defines the **simplified v1** of the product: a **public, read-only feed of automatic GitHub activity posts**, with minimal multi-user support and no social interactions.

---

## 1. Goals

- **Make my work public**: Anyone can visit a URL and see a timeline of GitHub-driven activity across projects.
- **Zero manual posting**: All posts are generated automatically from GitHub commits. No text composer, no image uploads.
- **Tiny surface area**: Only the minimum auth, data model, and UI needed to support the above.
- **Future-friendly**: Data model and routes are shaped so we can later add manual posts, comments, streak logic, etc., without major rewrites.

Non-goal for v1: maximize engagement. The primary outcome is **“I can reliably see and show a public log of work-in-progress”**.

---

## 2. User Flows

### 2.1 Anonymous visitor

- Visits `/`.
- Sees a **global activity feed** of all users’ auto-generated posts:
  - GitHub avatar + username.
  - Project/repo name.
  - Short activity summary (e.g. “3 commits to `app.build-in-public`”).
  - Timestamp (UTC).
  - Link to the corresponding GitHub repo (or latest commit).
- Can click into a user page (`/u/:username`) to see only that user’s activity.

No login is required to view anything.

### 2.2 New user (first-time setup)

- Clicks **“Sign in with GitHub”**.
- Completes GitHub OAuth.
- Lands on a **simple onboarding screen**:
  - Sees a list of their GitHub repositories (or a search input).
  - Selects **one repo** to track for v1 (we can support multiple later).
- After selecting a repo:
  - The system stores:
    - User record (GitHub id, username, avatar).
    - Project record (at minimum, the linked repo).
  - User is redirected to their profile page `/u/:username`.

### 2.3 Returning user

- Logs in via **“Sign in with GitHub”**.
- Redirected to `/u/:username`.
- Optionally can change the tracked repo from a simple settings/profile area, but this is **not required for v1**.

---

## 3. Features In Scope

### 3.1 Authentication

- **GitHub OAuth only**.
- Create or update a local user record on successful login.
- No password flows, no email, no other identity providers.

### 3.2 GitHub Integration

- v1 target: **one-tracked-repo-per-user**.
- Integration **must** use a **GitHub Webhook**:
  - The tracked repo is configured to send push/commit events to our backend webhook endpoint.
- For each user:
  - We maintain the **last processed commit timestamp or SHA** per tracked repo.
  - Only **public GitHub repositories** are supported in v1 (no private repo access or additional scopes).
  - On new events, we store commit metadata (at least: timestamp, count, repo).

### 3.3 Auto-Generated Activity Posts

- A **Post** (or **Activity**) record is created **per user per UTC day** when:
  - There is ≥1 new commit to their tracked repo(s) on that UTC day.
- Each activity post contains:
  - `user_id`.
  - `project_id` or `repo_id`.
  - `date_utc` (logical activity date).
  - `commit_count` (number of commits for that day to that tracked repo).
  - `first_commit_at` / `last_commit_at` (for ordering and display).
  - Optional: link to GitHub compare or latest commit.
- **Idempotency**:
  - If more commits arrive for the same user+day, we **update** the existing activity post rather than creating a new one.

### 3.4 Global Feed (`/`)

- Public, no login required.
- Shows a **reverse-chronological list** of recent activity posts, ordered by `last_commit_at` (or creation time).
- Each item shows:
  - User avatar and name.
  - Repo name.
  - Commit count (e.g., “1 commit”, “3 commits”).
  - Relative time (e.g., “2h ago”) and UTC date.
  - Link to GitHub.
- Pagination or simple “Load more” is sufficient for v1; no infinite scroll required.

### 3.5 User Profile Feed (`/u/:username`)

- Public, no login required.
- Shows only that user’s activity posts, newest first.
- Minimal header:
  - Avatar, username.
  - Optional short project label: current tracked repo name.
- Optional for v1 (if time allows): display a simple numeric **streak count** derived from consecutive active days. No special logic beyond “did we have an activity post for that UTC day?”.

### 3.6 Minimal Settings

- Authenticated users can:
  - See which repo is currently tracked.
  - Optionally **change** the tracked repo (this can be a small form on the profile page or a dedicated `Settings` page).
- No notification settings, email, timezone overrides, or advanced account management in v1.

---

## 4. Explicit Non-Goals for V1

**Intentionally out of scope** for this v1:

- **Manual posts**:
  - No text composer, no image uploads, no custom “5-minute” writeups.
- **Social interactions**:
  - No hearts/likes, no comments, no social graph.
- **Advanced streak logic**:
  - No 48-hour rule, no freeze tokens, no “At Risk” vs “Safe” status.
- **Gamification**:
  - No levels, badges, time capsules, or “Ship” events.
- **Media**:
  - No video or audio upload.
- **Additional integrations**:
  - No Strava, Figma, Duolingo, etc.

---

## 5. Minimal Architecture (V1)

- **Project layout**: The application lives in an **`app`** folder at the same level as `docs` (i.e. `app/` and `docs/` are siblings at the repo root).
- **Frontend**: Next.js app (deployed on **Vercel**) with the following pages:
  - `/` – Global activity feed (includes “Sign in with GitHub” button for authenticated actions).
  - `/u/:username` – Per-user activity feed.
  - `/settings` or a small authenticated section in `/u/:username` – Change tracked repo.
- **Backend**:
  - Node.js/TypeScript API implemented **within the same Next.js app** via API routes, deployed on **Vercel** alongside the frontend.
  - Routes for:
    - GitHub OAuth callback.
    - GitHub webhook endpoint (or polling worker job).
    - Activity feed queries (global and per-user).
- **Database**: **Supabase** (hosted PostgreSQL):
  - Schema and changes are managed with the **Supabase CLI** (migrations).
  - Tables: `users`, `projects`/`tracked_repos`, `activities` as below.
  - `users`: id, github_id, username, avatar_url, created_at.
  - `projects` or `tracked_repos`: id, user_id, repo_full_name, repo_url, created_at, active (bool).
  - `activities`: id, user_id, project_id, date_utc, commit_count, first_commit_at, last_commit_at, github_link.

---

## 6. Success Criteria for V1

We can call v1 “good enough” when:

- I can:
  - Sign in with GitHub.
  - Choose a repo to track.
  - Push commits on different days.
  - Visit `/` and see those days appear as activity posts.
  - Share `/u/:my-username` with others so they can see my history.
- The system:
  - Handles new commits idempotently (no duplicate posts per day).
  - Can support at least a small number of other users doing the same without schema changes.

