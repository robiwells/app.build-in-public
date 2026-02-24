# V3 Part B: Social Engine

**Build after Part A.** Part B adds hearts, comments, category filtering, and post detail threads. It assumes Part A is done: unified posts (manual + auto), streaks, freeze tokens, and basic profile/settings.

---

## 0. Current architecture (reference)

Part B builds on the **post–Part A** codebase. Below is the state after Part A.

- **“Post” = one row in `activities`.** There is no separate `posts` table. Each activity row has `id` (UUID), `user_id`, `project_id`, `type` (`auto_github` | `manual`), `content_text`, `content_image_url`, `date_utc`, `last_commit_at`, etc. Use **`activities.id`** as the post id everywhere (feed cards, post detail URL, hearts/comments FKs).
- **Auth:** NextAuth with GitHub. Session has `user.userId` (= `users.id`), `user.username`.
- **Tables (after Part A):** `users`, `projects` (with **category**), `project_repos`, **activities** (with type, content_text, content_image_url), `freeze_tokens`, `user_github_installations`, `webhook_events`. Part B adds **hearts** and **comments** only.
- **Feed APIs:** **GET /api/feed** (global), **GET /api/feed/u/[username]** (per-user). Both return activity rows with `users`, `projects`, `project_repos`; order by `last_commit_at` desc; cursor via `last_commit_at`. Part B extends feed to support `?category=...` and to return heart count and comment count (and “current user hearted”) per activity.
- **Pages:** **/** (landing + global feed), **/u/[username]** (profile: header, streak dashboard, ProjectManager for owner, activity list), **/u/[username]/projects/[projectId]** (project detail + activity), **/settings** (Connectors, freeze vault, timezone). Part B adds **/p/[postId]** (post detail = single activity with hearts and comment thread).
- **Routing:** App uses Next.js App Router; dynamic segments are **brackets** (e.g. `/p/[postId]`, `/u/[username]`).

---

## 1. Scope

- **In scope for Part B**
  - **Hearts:** Like posts; show count and “have I hearted?”
  - **Comments:** Linear thread per post; add/delete own.
  - **Category filter bar** on global feed (filter by project category).
  - **Post detail view** (**`/p/[postId]`**): full post, hearts list, comment thread.
  - **Login gateway:** Unauthenticated heart/comment clicks → login prompt.
  - Optional: real-time-ish updates (polling or websockets) for feed/hearts/comments.
- **Prerequisites (from Part A)**
  - Posts (manual + auto) with `project_id` and project `category`.
  - Global and profile feeds; profile streak dashboard; settings.

---

## 2. Data Model

### 2.1 Hearts

- Table: **`hearts`**
  - `id` (PK, uuid)
  - `user_id` (FK → `users.id`)
  - **`post_id`** (FK → **`activities.id`**; “post” = one activity row)
  - `created_at`
- Unique constraint on `(user_id, post_id)` so one heart per user per post.
- RLS or API checks: only allow hearting activities that exist and are visible (e.g. activity’s project is active).

### 2.2 Comments

- Table: **`comments`**
  - `id` (PK, uuid)
  - **`post_id`** (FK → **`activities.id`**)
  - `user_id` (FK → `users.id`)
  - `body` (text, required)
  - `created_at`, `updated_at`
- Part B: linear thread only (no replies, no mentions). Optional: user can delete own comment (by id, enforce `user_id` = current user).

### 2.3 Categories (from Part A)

- **`projects.category`** (text, e.g. Coding, Writing, Art, Fitness, Music, Other). Part A adds this.
- Category for a “post” = `activities.project_id` → `projects.category`. Use for filter bar and category chips on cards. Filter by `projects.category` when querying activities (join projects).

---

## 3. API (Part B)

**Convention:** `postId` in routes is **`activities.id`** (UUID). No separate “posts” table; “post” = activity row.

### 3.1 Hearts

- **POST /api/activities/[postId]/hearts** (or **POST /api/posts/[postId]/hearts** if you prefer a `/posts` namespace)
  - Toggle: if current user already hearted, delete row; else insert. Return `{ heartCount, hearted }`. Auth required. Validate `postId` is a valid activity id (and optionally that the activity is visible).
- **GET /api/activities/[postId]/hearts** (optional)
  - List users who hearted (id, username, avatar_url) for “X, Y and 3 others” on detail page; or return only count and “current user hearted” and fetch list only on post detail.

### 3.2 Comments

- **GET /api/activities/[postId]/comments**
  - List comments for this activity (chronological by `created_at`); include author (id, username, avatar_url), body, created_at.
- **POST /api/activities/[postId]/comments**
  - Body: `{ body }`. Auth required. Create comment; return new comment with author info.
- **DELETE /api/comments/[commentId]**
  - Auth required; only comment author (check `comments.user_id` = session user). Hard-delete or soft-delete per policy.

### 3.3 Feed & Post Detail

- **GET /api/feed** (extend existing)
  - Query: **`category`** (optional). When present, filter to activities whose **project** has that category (join `projects`, e.g. `.eq('projects.category', category)`). Response already includes project; add **heart_count** and **comment_count** (and **hearted** for current user if authenticated) per activity.
- **GET /api/feed/u/[username]** (extend existing)
  - Same category + heart/comment fields when used for profile feed.
- **GET /api/activities/[postId]** (new) — for post detail page
  - Return single activity with: full content (type, content_text, content_image_url, date_utc, commit_*, etc.), author (users), project (with category), repo if any, **heart_count**, **hearted** (boolean for current user), **comments** (list with author) or **comment_count** only (and fetch comments via GET comments).

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
- **Content:** Full post (text + image for manual; commit summary/link for auto), author (avatar, username → `/u/[username]`), project (title, category, link to `/u/[username]/projects/[projectId]` if desired).
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
- **Comments:** After submit, append to list or refetch; show new comment with author info.
- **Category filter:** Persist selection in URL (e.g. `/?category=coding`) so shareable and back-button friendly.
- **Real-time:** Not required for Part B; polling or “load more” is enough. Real-time can be a later improvement.

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

1. **Migrations:** Create **`hearts`** (id, user_id, post_id → activities.id, created_at; unique(user_id, post_id)) and **`comments`** (id, post_id → activities.id, user_id, body, created_at, updated_at). **activities** already has stable UUID **id**; use it as `post_id` in FKs. Add RLS or rely on API checks so only visible activities can be hearted/commented.
2. **APIs:** Hearts toggle (POST), comments list/create (GET/POST) and delete (DELETE), **GET /api/activities/[postId]** for post detail (activity + heart count + hearted + comments or counts).
3. **Feed:** Extend **GET /api/feed** and **GET /api/feed/u/[username]** to accept **`?category=...`** (filter by `projects.category`); include **heart_count**, **comment_count**, and **hearted** (for current user) per activity. Ensure **projects** join includes **category** in select.
4. **Post detail page:** Add **/p/[postId]/page.tsx**; fetch activity + hearts + comments; render full post, heart list, comment thread, add-comment form (auth) or login CTA (guest).
5. **Login gateway:** In feed and post detail, when guest clicks heart or comment, redirect to sign-in with callbackUrl back to current page (or open modal with sign-in CTA).
