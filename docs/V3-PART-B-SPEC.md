# V3 Part B: Social Engine

**Build after Part A.** Part B adds hearts, comments, category filtering, and post detail threads. It assumes Part A is done: unified posts (manual + auto), streaks, streak freeze (single toggle), and basic profile/settings.

---

## 0. Current architecture (reference)

Part B builds on the **post–Part A** codebase. Below is the state after Part A.

- **“Post” = one row in `activities`.** There is no separate `posts` table. Each activity row has `id` (UUID), `user_id`, `project_id`, `type` (`auto_github` | `manual`), `content_text`, `content_image_url`, `date_utc`, `last_commit_at`, etc. Use **`activities.id`** as the post id everywhere (feed cards, post detail URL, hearts/comments FKs).
- **Auth:** NextAuth with GitHub. Session has `user.userId` (= `users.id`), `user.username`.
- **Tables (after Part A):** `users`, `projects` (with **category**), `project_repos`, **activities** (with type, content_text, content_image_url), `user_github_installations`, `webhook_events`. Part B adds **hearts** and **comments** only.
- **Feed APIs:** **GET /api/feed** (global), **GET /api/feed/u/[username]** (per-user). Both return activity rows with `users`, `projects`, `project_repos`; order by **last_commit_at DESC, id DESC** (per Part A for stable pagination); cursor via `(last_commit_at, id)`. When extending the feed, keep this ordering and cursor unchanged. Part B extends feed to support `?category=...` and to return heart count and comment count (and “current user hearted”) per activity.
- **Pages:** **/** (landing + global feed), **/u/[username]** (profile: header, streak dashboard, ProjectManager for owner, activity list), **/u/[username]/projects/[projectId]** (project detail + activity), **/settings** (Connectors, timezone). Part B adds **/p/[postId]** (post detail = single activity with hearts and comment thread).
- **Routing:** App uses Next.js App Router; dynamic segments are **brackets** (e.g. `/p/[postId]`, `/u/[username]`).
- **Naming convention:** To keep the frontend and backend intuitive, stick to **one naming convention in the code**. Since Part A unified everything under **activities**, use that internally (API routes: `/api/activities/[postId]/...`, FKs: `post_id` → `activities.id`). Keep **`/p/[postId]`** as the **public-facing URL** for brevity (short, shareable links).

---

## 1. Scope

- **In scope for Part B**
  - **Hearts:** Like posts; show count and “have I hearted?”
  - **Comments:** Linear thread per post; add/delete own.
  - **Category filter bar** on global feed (filter by project category).
  - **Post detail view** (**`/p/[postId]`**): full post, hearts list, comment thread.
  - **Login gateway:** Unauthenticated heart/comment clicks → login prompt.
  - **Real-time comments:** New comments should appear automatically in real-time on the post detail page. Supabase Realtime can be toggled on for the `comments` table later (very easy to add). Optional: real-time for feed/hearts as a later improvement.
- **Prerequisites (from Part A)**
  - Posts (manual + auto) with `project_id` and project `category`.
  - Global and profile feeds; profile streak dashboard; settings.

---

## 2. Data Model

### 2.1 Hearts

- Table: **`hearts`**
  - `id` (PK, uuid)
  - `user_id` (FK → `users.id` ON DELETE CASCADE)
  - **`post_id`** (UUID, FK → **`activities.id`** ON DELETE CASCADE; "post" = one activity row)
  - `created_at`
- Unique constraint on `(user_id, post_id)` so one heart per user per post.
- **Implementation:** Ensure **`activities.id`** is indexed (PK is indexed by default). ON DELETE CASCADE on both FKs so deleting an activity or user cleans up hearts automatically.
- **Visibility:** Allow hearting only activities that **exist**. "Visible" = same as feed visibility (activity exists; may have null project per Part A). RLS or API checks enforce this.

### 2.2 Comments

- Table: **`comments`**
  - `id` (PK, uuid)
  - **`post_id`** (FK → **`activities.id`** ON DELETE CASCADE)
  - `user_id` (FK → `users.id` ON DELETE CASCADE)
  - **`body`** (TEXT, required; **max length e.g. 1000 chars** to prevent DB abuse)
  - `created_at`, `updated_at`
- Part B: linear thread only (no replies, no mentions). Optional: user can delete own comment (by id, enforce `user_id` = current user).

### 2.3 Counter cache on activities (optional, recommended)

- Add **`hearts_count`** (INT, default 0) and **`comments_count`** (INT, default 0) to the **`activities`** table. Update these via **database triggers** whenever a heart or comment is added or removed. This makes feed queries extremely fast (no per-row subqueries or joins for counts).
- Triggers: on INSERT/DELETE to `hearts`, increment/decrement `activities.hearts_count` for the corresponding `post_id`; same for `comments` and `comments_count`.

### 2.4 Categories (from Part A)

- **`projects.category`** (text, e.g. Coding, Writing, Art, Fitness, Music, Other). Part A adds this. **Post inherits category from project.**
- Category for a “post” = `activities.project_id` → `projects.category`. Use for filter bar and category chips on cards. Filter by `projects.category` when querying activities (join projects).

---

## 3. API (Part B)

**Convention:** `postId` in routes is **`activities.id`** (UUID). No separate “posts” table; “post” = activity row.

### 3.1 Hearts

- **POST /api/activities/[postId]/hearts**
  - Toggle: if current user already hearted, delete row; else insert. Return `{ heartCount, hearted }`. Auth required. Validate `postId` is a valid activity id (and optionally that the activity is visible).
- **GET /api/activities/[postId]/hearts** (optional)
  - List users who hearted (id, username, avatar_url) for “X, Y and 3 others” on detail page; or return only count and “current user hearted” and fetch list only on post detail.

### 3.2 Comments

- **GET /api/activities/[postId]/comments**
  - List comments for this activity (chronological by `created_at`); include author (id, username, avatar_url), body, created_at.
- **POST /api/activities/[postId]/comments**
  - Body: `{ body }`. Auth required. **body** required; **max length 1000 chars** (reject otherwise) to prevent DB abuse. Create comment; return new comment with author info.
- **DELETE /api/comments/[commentId]**
  - Auth required; only comment author (check `comments.user_id` = session user). Return **404** when the comment does not exist; **403** when the current user is not the author. Hard-delete or soft-delete per policy.

### 3.3 Feed & Post Detail

- **GET /api/feed** (extend existing)
  - Query: **`category`** (optional). When present, filter to activities whose **project** has that category (join `projects`). Compare **case-insensitively** (e.g. normalize `category` param and `projects.category` to the same form, or use ilike/upper). **Join logic:** Specifically handle activities where **`project_id` might be null** (Part A allows ON DELETE SET NULL on project): when filtering by category, exclude those rows (they have no category), or include them only when no category filter is applied ("All"). Response already includes project; add **heart_count** and **comment_count** (and **hearted** for current user if authenticated) per activity—use counter cache columns `hearts_count`/`comments_count` if present for performance.
- **GET /api/feed/u/[username]** (extend existing)
  - Same category + heart/comment fields when used for profile feed.
- **GET /api/activities/[postId]** (new) — for post detail page
  - Return single activity with: full content (type, content_text, content_image_url, date_utc, commit_*, etc.), author (users), project (with category), repo if any, **heart_count**, **hearted** (boolean for current user), **comments** (list with author) or **comment_count** only (and fetch comments via GET comments). Return **404** when the activity does not exist.

---

## 4. Screens (Part B)

### 4.1 Global Feed (`/`)

- **Category filter bar** at top: chips for each category (e.g. Coding, Writing, Art, Fitness, Music, All). Selecting a category filters feed (e.g. `/?category=coding`); feed API supports `?category=...`.
- **Post cards** (guest and authenticated): Reuse/extend **ActivityItem** (or equivalent) to show:
  - Avatar, username (link to `/u/[username]`), project + **category chip**, text (content_text or commit summary), optional image.
  - **Heart button:** show count; guest click → login prompt; auth → toggle via POST hearts API.
  - **Comment count** (or “Comment” link) → link to **`/p/[postId]`** (postId = `activity.id`) for thread.

### 4.2 Post Detail (`/p/[postId]`)

- **Route:** **`/p/[postId]`** (App Router dynamic segment). `postId` = `activities.id`.
- **Data:** GET /api/activities/[postId] (or fetch activity + hearts + comments separately).
- **Content:** Full post (text + image for manual; commit summary/link for auto), author (avatar, username → `/u/[username]`), project (title, category, link to `/u/[username]/projects/[projectId]` if desired). If **project_id** is null (deleted project), show a placeholder (e.g. "Unknown project") and no project link.
- **Hearts:** Count + list of users who hearted (e.g. “Alice, Bob and 3 others”); heart button toggles for auth user.
- **Comments:** Linear list (avatar, username, body, timestamp); input at bottom to add comment (auth only; guest → login prompt); “Delete” on own comments.

### 4.3 User Profile (`/u/[username]`)

- Same as Part A (header, streak dashboard, ProjectManager for owner, activity list). Part B adds to each **activity card**: heart count, comment count, and link to **`/p/[postId]`** (so users can open the thread). No need to embed full comment thread on profile.

### 4.4 Login / Gateway

- When a **guest** clicks “Heart” or “Add comment”, show **login prompt** (modal or redirect to **`/api/auth/signin?callbackUrl=...`**): “Sign in with GitHub to like or comment.”
- Reuse existing NextAuth GitHub sign-in; optional copy: “Continue with GitHub” + short social proof (e.g. “Join builders staying consistent.”).

---

## 5. UI Behavior

- **Hearts:** Optimistic update optional; ensure count and state stay correct after toggle.
- **Comments:** After submit, append to list or refetch; show new comment with author info. **New comments should appear automatically in real-time** on the post detail page (Supabase Realtime can be toggled on for the `comments` table later).
- **Category filter:** Persist selection in URL (e.g. `/?category=coding`) so shareable and back-button friendly.
- **Real-time:** Not required for Part B; polling or “load more” is enough. Real-time comments on post detail is recommended; Supabase Realtime is easy to toggle on for the `comments` table. Feed/hearts can use polling or be added later.

---

## 6. Moderation (Optional for Part B)

- Users can delete their own comments.
- No edit, no report flow required for Part B; can add later.

---

## 7. Success Criteria (Part B)

- Authenticated users can heart/unheart posts and add/delete own comments.
- Guests see hearts and comments but are prompted to log in when they try to act.
- Global feed has a working category filter; post detail page shows full thread and heart list.
- Data integrity: heart counts and comment lists match DB; no duplicate hearts per user/post.

---

## 8. Build Order Suggestion

1. **Migrations:** Ensure **`activities.id`** is indexed (PK is indexed by default). Create **`hearts`** (id, user_id → users.id ON DELETE CASCADE, post_id → activities.id ON DELETE CASCADE, created_at; unique(user_id, post_id); index on post_id). Create **`comments`** (id, post_id → activities.id ON DELETE CASCADE, user_id → users.id ON DELETE CASCADE, body TEXT with max length 1000, created_at, updated_at; index on post_id). Add **counter cache columns** to **`activities`**: **`hearts_count`** INT default 0, **`comments_count`** INT default 0. Add **database triggers** to update these when a heart or comment is inserted/deleted. Add RLS or rely on API checks so only visible activities can be hearted/commented.
2. **APIs:** Use **/api/activities/[postId]/...** for all post-scoped routes. Hearts toggle (POST), comments list/create (GET/POST) and delete (DELETE), **GET /api/activities/[postId]** for post detail (activity + heart count + hearted + comments or counts).
3. **Feed:** Extend **GET /api/feed** and **GET /api/feed/u/[username]** to accept **`?category=...`** (filter by `projects.category`); include **heart_count**, **comment_count**, and **hearted** (for current user) per activity. Use counter cache columns `hearts_count`/`comments_count` when present. Handle **project_id null** (Part A): when filtering by category, exclude those rows or include only when no category filter ("All"). Ensure **projects** join includes **category** in select.
4. **Post detail page:** Add **/p/[postId]/page.tsx**; fetch activity + hearts + comments; render full post, heart list, comment thread, add-comment form (auth) or login CTA (guest).
5. **Login gateway:** In feed and post detail, when guest clicks heart or comment, redirect to sign-in with callbackUrl back to current page (or open modal with sign-in CTA).
