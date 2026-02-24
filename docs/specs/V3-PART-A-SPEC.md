# V3 Part A: Manual Check-ins & Streaks

**Build this first.** Part A adds manual posts and streak mechanics on top of the existing GitHub auto-feed (V1/V2). No social layer yet—that’s Part B.

---

## 0. Current architecture (reference)

Align Part A with the existing codebase:

- **Auth:** NextAuth with GitHub only. Session has `user.userId` (maps to `users.id`), `user.username`.
- **Tables:** `users`, `projects`, `project_repos`, `activities`. Activities link to `project_id`; users can have multiple projects.
- **Feed:** Global and per-user feeds query **activities** with `users!inner`, **projects left-joined** (so activities whose project was deleted still appear; show placeholder e.g. "Unknown project" when `project_id` is null), `project_repos` optional; order by **last_commit_at DESC, id DESC** (secondary sort on **id** ensures stable ordering when timestamps tie; required for correct cursor pagination). Cursor pagination uses `(last_commit_at, id)`. Routes: **GET /api/feed**, **GET /api/feed/u/[username]**.
- **Pages:** Landing **/** (global feed), **/u/[username]** (profile), **/settings** (Connectors). Project create/edit lives on profile (ProjectManager).
- **Projects:** Users can have multiple projects; each project has title, description, url, 0+ repos (project_repos). Part A adds **category** to projects.

---

## 1. Scope

- **In scope for Part A**
  - Unified **post** model (manual + auto).
  - **Manual check-ins:** text + optional single image (**Supabase Storage**).
  - **Streak logic:** Based on **user timezone** (local day boundary): **At Risk** only if user hasn't posted in **2 days**; streak **resets** at the **start of the third missed local day (00:00 local)** when computing streak state. Status: Safe / At Risk / Frozen.
  - **Streak freeze:** Single toggle; auto-unfreezes on next activity or when user unfreezes. **Freeze does not restore or protect a streak that has already reset** under the 3-day rule.
  - **Streaks dashboard:** Consistency grid (heatmap) + freeze/unfreeze control + **safe-unfreeze warnings** (confirm before unfreezing when reset is imminent).
  - Feeds (global + profile) showing both manual and auto posts.
  - **Profile:** Streak summary (clickable) → **Streaks dashboard** (`/u/[username]/streaks`).
  - Settings: project name/category (on profile), **timezone** (user can set for accurate local-day streak).
- **Deferred to Part B**
  - Social layer (hearts, comments), category filters, post detail threads, login gateway copy.

---

## 2. Relationship to V1/V2

- **V1/V2 (current)**
  - Activities from GitHub commits only; global and per-user feeds; projects + project_repos.
- **Part A extends**
  - Same auth, same projects/repos.
  - Add manual posts and a unified “post” view over auto + manual.
  - Add streak state and a single "freeze streak" toggle (no token system); no new social tables yet.

---

## 2. Data Model Updates

### 2.1 Unified Post / Activity (activities table)

- **New columns:**
  - **`type`** TEXT (default `'auto_github'`; options: `'auto_github'`, `'manual'`).
  - **`content_text`** TEXT (nullable; required for manual).
  - **`content_image_url`** TEXT (nullable; Supabase Storage URL).
  - **`date_local`** DATE (nullable for backfill; set on insert). The **local calendar day** for this activity in the user's timezone; used for streak logic. Stored at creation time (computed from **users.timezone**), not derived on read.
- **Index changes:**
  - Drop existing **UNIQUE(user_id, project_id, date_utc)**.
  - Add **partial unique index** so only auto is one-per-day; allows multiple manual posts per day. Because **project_id** can be NULL after a project is deleted and Postgres treats NULL as distinct in unique indexes, use **COALESCE** so at most one auto row per (user_id, date_utc) when project_id is null:
    - `CREATE UNIQUE INDEX activities_auto_unique ON activities (user_id, COALESCE(project_id, sentinel), date_utc) WHERE (type = 'auto_github');`
    - Use a sentinel that is not a real project id (e.g. `'00000000-0000-0000-0000-000000000000'::uuid` for UUID, or `0` for integer PK).
- **Invariant:** **Auto activities must always have non-null project_id** at creation (GitHub-backed auto rows are always tied to a project). After a project is deleted, project_id may become NULL; the index above still enforces at most one auto row per user per date_utc in that case.
- **Deletion safety:** Update **project_id** FK to **ON DELETE SET NULL**. If a project is deleted, activities remain so streak history is preserved (activity rows keep user_id, date_utc, **date_local**; `project_id` becomes null). **Feed queries must left-join projects** (not inner-join) so these posts still appear in the feed; show a placeholder (e.g. "Unknown project") when `project_id` is null.
- **Local day for streaks:** **Store** **date_local** on each activity row. When an activity is created (manual or via webhook), compute the user's local calendar day from **users.timezone** and write it to **date_local**. All streak logic **reads** **date_local** from the table; do not derive it at query time. **date_utc** remains for feed ordering and backwards compatibility.
- **Manual rows:** Set `last_commit_at = created_at` for feed ordering; `commit_count` 0; `project_repo_id` null if no repo.

### 2.2 Streak & User State (users table)

- **`timezone`** TEXT (default `'UTC'`). Used to compute "local day" for streak (avoids UTC trap).
- **`streak_frozen`** BOOLEAN (default false). Single toggle; auto-unfreezes on next activity.
- **`streak_metadata`** JSONB (cache, optional): e.g. `{ "current_streak": int, "longest_streak": int, "last_active_day_local": "YYYY-MM-DD" }`. Updated atomically on post create or unfreeze.

### 2.3 Projects

- **`category`** TEXT (e.g. Coding, Writing, Art, Fitness, Music, Other). Used in Part B for filtering; in Part A store and show on cards.

---

## 3. Core Logic

### 3.1 The "Local Day" Boundary

- To prevent the **UTC trap** (e.g. user posts at 11 PM local but it counts as the next day in UTC), streak and active day use the **user's local day**, stored as **date_local** on **activities**.
- **On insert:** When an activity is created, compute the user's local calendar date from **users.timezone** and **store** it in **activities.date_local**. All streak logic (active day, at-risk/reset rules, consistency map) **reads** **date_local** from the table.
- **Backfill:** For existing activity rows, backfill **date_local** (e.g. set to **date_utc** for legacy data, or compute from **users.timezone** where available).

### 3.2 Streak Reset Rule & Atomic Updates

- **The rule:** A streak **resets** at the **start of the third missed local day (00:00 local)**, when computing streak state (while not frozen). So: last post on day 0; no activity on day 1 or day 2; at 00:00 local on day 3 the streak is 0.
- **Immutability:** The streak is **immutable once incremented**. If the user deletes a post (activity), the streak is **not** reduced or reset—they keep the streak.
- **Atomicity:** All streak increments/updates (on post create or unfreeze) must run inside a **database transaction** to avoid race conditions between GitHub webhooks and manual POST /api/posts.
- **Recompute gap on write (no blind increment):** Every **POST /api/posts** (and any webhook that creates an activity) must **recompute the streak gap** before updating streak: compare **last_active_day_local** (from activities or cache) to **today (local)**. If the gap is **≥ 3 local days**, set **current_streak = 1** (new streak); do **not** increment from cached **streak_metadata**. Otherwise increment. This is **transactionally enforced** so that a user who missed 3+ days and never opened the app, then posts on day 5, gets a correct **current_streak = 1**, not a stale increment. Relying only on lazy GET logic risks incorrectly incrementing from stale metadata.

### 3.3 Streak Status (Safe / At Risk / Frozen)

- **Safe:** User has posted within the last 2 days (local): posted today or yesterday. Streak is intact.
- **At Risk:** User **has not posted in 2 days** (local)—i.e. no post today and no post yesterday. At 00:00 local on the next (third missed) day, streak resets.
- **Frozen:** User has frozen their streak; streak is protected until they unfreeze or post again. **Freeze does not restore or protect a streak that has already reset** under the 3-day rule (once the third missed local day has started, the streak is 0 and freeze cannot bring it back).

### 3.4 Safe Unfreeze Guardrail

- If the user tries to **manually unfreeze** on the dashboard and unfreezing would reset their streak (e.g. they have already entered the third missed local day, so **last_active_day_local** is 2+ days ago and 00:00 local on the third missed day has passed), the UI must show a **confirmation modal**: e.g. "Unfreezing now will reset your streak to 0 because you haven't posted in 3 days. Post first to save your streak!" Require explicit confirmation (e.g. **confirm_reset: true** in API) before clearing the frozen flag when reset is imminent.

---

## 4. Supabase Image Storage

- **Bucket:** **activity_images**. Store manual post images; URL saved in **activities.content_image_url**. Use a path pattern that includes the user id, e.g. **`activity_images/${user_id}/*`** (so each user has their own folder).
- **Permissions:** Public read; **authenticated write** with RLS.
- **RLS policy for writes:** Enforce that **auth.uid()** matches the **user_id** segment in the object path. For example: authenticated users may **insert/update/delete** only objects under **`activity_images/{user_id}/*`** where **{user_id}** equals **auth.uid()** (as string). This prevents users from overwriting or deleting each other's images. Example policy condition: path matches **`activity_images/` || auth.uid()::text || `/%'`** (or equivalent for your storage schema).

- **Image compression & optimization:** To ensure fast feed performance and minimize storage costs, all manual post images **must** undergo **client-side processing before upload**. Using a library such as **browser-image-compression** (or equivalent), images will be:
  - **Downscaled** to a maximum width of **1200px**.
  - **Converted** to **JPEG or WebP** at **0.75 quality**.
  - **Stripped of all EXIF metadata** (including GPS coordinates and other sensitive data) for user privacy.
  This process is mandatory before the file is uploaded to the **activity_images** bucket.

- **Image abuse guard (server-side):** The **server** must enforce **max size** (even after client compression) and allowed types (e.g. JPEG, WebP) on upload or on post create. Reject oversized or invalid files. **Limit to 1 image per post:** server validates that the request supplies at most one image URL per post and that the post is created with at most one **content_image_url**; reject or ignore extra image data.

- **Storage lifecycle — cleanup on activity delete:** To prevent orphaned storage bloat, whenever an **activity** row is **deleted**, the associated file in the **activity_images** bucket must be **hard-deleted**. Implement this via a **Supabase Edge Function** or **database webhook** (e.g. trigger on `activities` DELETE that calls storage API to remove the object at **content_image_url**). Parse the stored URL to get the bucket path and perform the delete; if the row has no **content_image_url**, skip. This keeps storage in sync with the database.

---

## 5. API (Part A)

- **POST /api/posts**
  - Handles manual post insertion: body `content_text`, optional **`content_image_url`** (at most one; server validates **one image per post**), **`project_id`**. Server validates image: **max size** (even after compression) and allowed types; reject if invalid. Server uses **today's date** only: sets **date_utc** (and feed timestamp) from current time, and **date_local** from the current user's **timezone** for the new activity row. No client-supplied dates. **Streak update (transactionally enforced):** Before incrementing streak, **recompute gap** (last_active_day_local → today local); if gap **≥ 3 days**, set **current_streak = 1**; otherwise increment. Never blindly increment from cached streak_metadata. Clears **streak_frozen**. Auth required.
- **GET /api/feed** and **GET /api/feed/u/[username]** (existing; must left-join projects so activities with deleted project still appear)
  - Extend to return both `auto_github` and `manual` rows; include `type`, `content_text`, `content_image_url`. Order by **last_commit_at DESC, id DESC** for stable pagination (equal timestamps break pagination without secondary sort).
- **GET /api/streak/status** (new)
  - Returns **current_streak**, **status** (Safe | At Risk | Frozen), **reset_imminent** (boolean; true when the third missed local day has started (00:00 local), so unfreezing now would reset streak). Optionally list of active days for consistency map (e.g. last 365 days). Public variant: **GET /api/users/[username]/streak** for profile/dashboard.
- **POST /api/streak/freeze** (new): Set current user streak as frozen. Auth required.
- **POST /api/streak/unfreeze** (new): Clear frozen state and recompute streak. When reset is imminent, requires **confirm_reset: true** in body. Auth required.
- **PATCH /api/users/me** (new): Update **timezone** (body: `{ "timezone": "America/New_York" }` or similar). Auth required.
- **Project / category:** Add **`category`** to `projects` (Coding, Writing, Art, Fitness, Music, Other). Used in Part B; in Part A store and show on cards.

---

## 6. Screens (Part A)

### 6.1 Landing & Global Feed (`/`)

- **Guest:** Header (product name, Login), hero, feed of posts (manual + auto). No composer; no streak widget.
- **Authenticated:**
  - **Composer** at top: “What did you do for 5 minutes today?” – text input + optional single image upload; submit creates manual post (**POST /api/posts**); image via **Supabase Storage** (see §4). **Timezone note:** If user timezone is UTC, show hint to update in settings for better streak accuracy.
  - **Daily status:** Current streak count; time until next local day (optional).
  - Same feed with both post types; no hearts/comments yet (Part B).

### 6.2 User Profile (`/u/[username]`)

- **Header:** Avatar, **username** (no separate display name today; `users` has username, avatar_url, **bio**). Optional later: “Project Mission” as a new user field or from primary project description.
- **Streak summary (on profile):** Show streak on the profile (e.g. flame + current streak count + status badge: Safe / At Risk / Frozen). This block is **clickable** and links to the **Streaks dashboard** (see 6.2b). Visitors and owner both see it.
- **Projects:** Owner sees **ProjectManager** (create/edit/delete projects, connect repos); visitors see list of projects with links to `/u/[username]/projects/[id]`. Add **category** to project create/edit when Part A adds it.
- **Activity feed:** User’s posts (manual + auto) reverse chronological; same card style as global feed (no comments/hearts in Part A). Reuse existing ActivityItem; extend to render manual posts (content_text, content_image_url).


### 6.2b Streaks Dashboard (new; linked from profile)

- **Route:** **`/u/[username]/streaks`**. When the user clicks the streak summary on the profile, they go here.
- **Content:** Flame + current streak count; status badge (Safe / At Risk / Frozen); **365-day consistency grid** (heatmap of active days). For the **profile owner only**: **Freeze / Unfreeze** control.
- **Safe-unfreeze warnings:** When unfreezing would reset the streak (third missed local day has started, 00:00 local), show confirmation modal before calling POST /api/streak/unfreeze; require **confirm_reset: true** when reset is imminent.
- **Public:** Visitors can view the dashboard (read-only); only the owner sees the freeze/unfreeze control.

### 6.3 Settings (`/settings`)

- **Connectors (existing):** GitHub install / reconfigure link.
- **Timezone (new):** “App uses UTC”; show current UTC and user’s local time.
- **Freeze streak** is controlled from the **Streaks dashboard** (`/u/[username]/streaks`), not from settings. No freeze tokens or vault.
- **Project editing** stays on profile (ProjectManager), not settings. When category exists, add category picker to project form there.
- Account “link/unlink GitHub” is via NextAuth (no separate UI required for Part A).

### 6.4 Onboarding (New / New Project)

- Existing flow: GitHub App install → repo picker (optional add to project). When creating a project (profile or onboarding), add **category picker** (Coding, Writing, Art, Fitness, Music, Other). Category and repo stored on project; posts inherit category from project.

---

## 7. Image Upload (Part A)

- Single image per manual post (server validates **one image per post**). **Supabase Storage** (see §4): bucket **activity_images**, public read / authenticated write, RLS by user path. **Client must** run image compression & optimization (see §4: max width 1200px, JPEG/WebP 0.75 quality, EXIF stripped) before upload. URL stored in **activities.content_image_url**. **Server enforces max size even after compression** and allowed types; reject oversized or invalid. When an activity is deleted, storage object is removed via Edge Function or DB webhook (see §4).

---

## 8. Success Criteria (Part A)

- User can create manual posts (text ± image) and see them in global and profile feeds.
- Auto (GitHub) and manual posts both count toward “active day” and streak.
- 2-day at-risk / 3-day reset rule (reset at start of third missed local day, 00:00 local, when computing streak state) and streak freeze (single toggle) behave as specified; status (Safe / At Risk / Frozen) is correct; freeze auto-unfreezes on next activity or when user unfreezes; **freeze does not restore or protect a streak that has already reset**; safe-unfreeze confirmation when reset imminent; **streak is immutable once incremented** (deleting a post does not reduce or reset streak); **every POST /api/posts recomputes streak gap before incrementing** (gap ≥ 3 days → current_streak = 1), transactionally enforced.
- Profile shows a streak summary (clickable) that goes to the Streaks dashboard; dashboard shows full consistency grid (heatmap), freeze/unfreeze control, and safe-unfreeze warnings.
- No hearts, comments, or category filter yet—those are Part B.

---

## 9. Dependencies & Order

- **Migrations (in order):**
  1. **activities:** Add `type` (text, default `'auto_github'`), `content_text` (text, nullable), `content_image_url` (text, nullable), **`date_local`** (date, nullable). Drop UNIQUE(user_id, project_id, date_utc); add partial unique index using **COALESCE(project_id, sentinel)** so NULL project_id does not allow multiple auto rows per day, e.g. `CREATE UNIQUE INDEX activities_auto_unique ON activities (user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), date_utc) WHERE (type = 'auto_github')` (adjust sentinel for integer PK if needed). Update **project_id** FK to **ON DELETE SET NULL** (preserve activities when project deleted).
  2. **projects:** Add `category` (text, nullable).
  3. **users:** Add **`timezone`** (text, default `'UTC'`), **`streak_frozen`** (boolean, default false), **`streak_metadata`** (JSONB, optional cache: e.g. `current_streak`, `longest_streak`, `last_active_day_local`).
  4. **Supabase Storage:** Create bucket **activity_images** (public read, authenticated write, RLS); optional cleanup when activity deleted.
- **Backfill:** Set `type = 'auto_github'` for all existing activity rows. **Backfill date_local** for existing activities (e.g. set `date_local = date_utc` for legacy rows, or compute from **users.timezone** where available).
- **Implementation order:** Streak logic (local day from timezone; atomic updates in transaction) → POST /api/posts + GET /api/streak/status → composer UI (Supabase image upload) → feed merge → profile streak summary (clickable) → Streaks dashboard (heatmap, freeze/unfreeze, safe-unfreeze modal) → settings (timezone via PATCH /api/users/me) → category on project create/edit.
- Part B will add: hearts, comments, post detail page, category filter bar, and any extra social copy.
