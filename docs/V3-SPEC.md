# V2 Spec: Full “5 Minutes a Day” Experience (Beyond V1)

This document defines the **next-stage product** built on top of the v1 GitHub-only auto feed described in `V1-SPEC.md`.

V2 focuses on turning the raw activity log into a **habit-forming, social “build in public” experience**, by adding manual check-ins, social interactions, and streak mechanics while preserving the simple, daily-proof-of-work core.

---

## 1. Relationship to V1

- **V1 (current)**:
  - Multi-user GitHub OAuth.
  - Users track a repo and generate **automatic, per-day activity posts** based on commits.
  - Public, read-only global feed (`/`) and per-user feeds (`/u/:username`).
  - No manual posts, comments, likes, streak logic, or gamification.

- **V2 (this spec)** adds:
  - Manual text/image check-ins.
  - A richer **Social Engine**: hearts, comments, categories, filters.
  - **Streak & Grace Logic**: 48-hour rule, streak states, and freeze tokens.
  - More complete screens: upgraded landing page, profile with streak map, post detail threads, and a proper settings dashboard.

All new features should **reuse the V1 data model where possible**, extending it rather than rewriting.

---

## 2. Core Feature Additions

### 2.1 The Check-in System (Manual + Auto)

#### 2.1.1 Manual Posts

- **New capability**: Users can create **manual check-ins** in addition to auto GitHub posts.
- Each manual post includes:
  - `user_id`.
  - Optional `project_id` / tracked project.
  - **Content**:
    - Required text field (short to medium-length).
    - Optional image upload (one image v2, multiple images can be future).
  - `created_at` timestamp (UTC).
- Manual posts:
  - Appear in the **global firehose** and **user profile feed**, interleaved with auto posts by time.
  - Count towards streak logic the same way GitHub-backed activity does (see 2.3).

#### 2.1.2 Updated Activity Model

- Introduce (or generalize to) a unified **Post** / **Update** entity:
  - `id`
  - `user_id`
  - `project_id` (optional)
  - `type` (e.g., `auto_github`, `manual`)
  - `content_text` (nullable; required for `manual`)
  - `content_image_url` (nullable)
  - `activity_date_utc` (logical activity date for streaks)
  - `created_at`, `updated_at`
  - `metadata` JSON (e.g., commit_count, repo_full_name, github_links)
- V1 activities (auto-only) map into this model as `type = auto_github`.
- V2 manual posts simply use `type = manual` and fill out the content fields.

#### 2.1.3 The 5-Minute Philosophy

- Still **no hard timer**: any of the following count as “showing up” for a given UTC day:
  - At least one auto GitHub post for the day.
  - At least one manual post for the day.
- The UI language emphasizes:
  - “Log even a tiny step.”
  - “5 minutes counts.”

---

### 2.2 Social Engine

V2 brings the “social” layer on top of posts/updates.

#### 2.2.1 Global Firehose Enhancements

- Global feed (`/`) now:
  - Includes both `auto_github` and `manual` posts.
  - Displays a **post card** with:
    - User avatar + username.
    - Project/category chips.
    - Text + optional image.
    - Social actions: heart button, comment count.
  - Uses **real-time-ish updates** (polling or websockets) where feasible, but real-time is not strictly required for initial V2.

#### 2.2.2 Interactions: Hearts

- Users can “Heart” any post when authenticated.
- Model:
  - `hearts`: `id`, `user_id`, `post_id`, `created_at`.
  - Enforce uniqueness on (`user_id`, `post_id`) to prevent duplicates.
- UI:
  - Heart icon on each post.
  - Shows total heart count and whether the current user has hearted it.
- For unauthenticated users:
  - Clicking heart shows a **login prompt** instead of performing the action.

#### 2.2.3 Interactions: Comments

- Users can add **comments** to posts when authenticated.
- Model:
  - `comments`: `id`, `post_id`, `user_id`, `body`, `created_at`, `updated_at`.
- Minimal features:
  - Linear, chronological comment thread.
  - No replies, threads, or mentions in v2.
  - Basic moderation controls (e.g., user can delete their own comments) can be added if time permits.

#### 2.2.4 Categorization & Filtering

- Each **project** (or primary tracked effort) has a **category**, e.g.:
  - `#Coding`, `#Writing`, `#Art`, `#Fitness`, `#Music`, `#Other`.
- Posts inherit the category from their associated project.
- UI:
  - Category chips rendered on post cards.
  - On the global feed:
    - A **Category Filter Bar** at the top with toggle chips.
    - Selecting a category filters the feed to posts matching that category.

#### 2.2.5 Public Profiles

- Public profile (`/u/:username`) expands to include:
  - Profile header:
    - Avatar.
    - Display name / username.
    - Short bio.
    - “Project Mission” / one-sentence description.
  - Streak dashboard (see 2.3).
  - A chronological list of this user’s posts (both manual and auto), with the same card UI.

---

### 2.3 Streak & Grace Logic

V2 introduces **streaks**, a **48-hour grace rule**, and **freeze tokens**.

#### 2.3.1 Definitions

- **Active day**:
  - A UTC day on which the user has **at least one post** (manual or auto) associated with their current project.
- **Missed day**:
  - A UTC day with **no posts**, unprotected by a freeze token.

#### 2.3.2 The 48-Hour Rule

- A user’s streak **does not reset** on the first missed day.
- The streak only resets if the user misses **two consecutive UTC days** with:
  - No posts, and
  - No active freeze tokens covering those days.
- Implementation approach:
  - Maintain `streak_count`, `last_active_date_utc`, and a history of active days.
  - A scheduled job (or logic on post creation) updates streaks based on recent activity.

#### 2.3.3 Streak Status States

- Introduce three visual states on the profile:
  - **Safe**:
    - The user has posted today (or within the last UTC day) and is not at risk of an imminent reset.
  - **At Risk**:
    - The user is approaching a potential reset under the 48-hour rule (e.g., no activity today but activity yesterday).
  - **Frozen**:
    - The user has activated a freeze token that covers the current UTC day.
- Status is calculated from:
  - Current UTC date.
  - The user’s streak data and latest activity.
  - Any active freeze tokens.

#### 2.3.4 Freeze Tokens

- Each user is granted a **limited number of freeze tokens**.
- A freeze token, when activated:
  - Marks a specific UTC day (or range of days) as “protected”.
  - Missed days covered by a freeze **do not break the streak**.
- Model:
  - `freeze_tokens`: `id`, `user_id`, `status` (`available`, `used`), `used_for_date_utc` (or date range), `created_at`, `used_at`.
- UI:
  - Display remaining freezes in the **Settings / Dashboard**.
  - Allow user to activate a freeze for today or an upcoming/planned date.

---

## 3. Screen-Level Changes (V2)

These map directly to the “Screens” section in `DESIGN-DOC.md`.

### 3.1 Landing & Global Firehose (`/`)

- **Guest View**:
  - Header:
    - Product name (“5 Minutes a Day”).
    - **“Login”** button (GitHub).
  - Hero section:
    - Short, punchy value prop about building in public and showing up daily.
    - Possibly a small visual (screenshot or streak map).
  - Feed:
    - Scrollable list of all posts (manual + auto).
    - Heart/comment buttons are visible but:
      - For guests, clicking them triggers the login gateway instead of taking action.
  - Category Filter Bar.

- **Authenticated View**:
  - Adds a **composer** box at top:
    - Prompt: “What did you do for 5 minutes today?”
    - Text input for manual post.
    - Image upload control (single image v2).
  - Shows daily status widget:
    - Current streak count.
    - Time remaining to the next UTC day (see 3.4).
  - Same global feed, now with interactive hearts/comments.

### 3.2 Login / Gateway Screen

- Dedicated login route or modal:
  - Primary button:
    - “Continue with GitHub”.
  - Social proof text:
    - e.g., “Join 1,200+ builders staying consistent today.”

### 3.3 Onboarding / Project Setup

- Shown only to:
  - New users.
  - Users starting a new project.
- Content:
  - **Project Name**: “What are you working on?”.
  - **Category Picker**:
    - Visual grid of icons (Coding, Art, Writing, Fitness, Music, Other).
  - **GitHub Hook**:
    - If logged in via GitHub:
      - Searchable dropdown listing their public repos.
      - Option to toggle auto-tracking on/off.
  - The selected category and repo connect to the project record; posts inherit the category.

### 3.4 User Profile Page (Public)

- Enhancements beyond V1:
  - Profile header:
    - Avatar, display name, username.
    - Short bio and “Project Mission” field.
  - Streak Dashboard:
    - **Flame icon** with current streak count (e.g., “15 days”).
    - **Status**: Safe / At Risk / Frozen.
    - **Grid**: 365-day consistency map (GitHub-style), derived from daily active status.
  - Personal Feed:
    - All of the user’s posts (manual + auto) in reverse chronological order.

### 3.5 Post Detail View (Thread)

- Route like `/p/:postId`.
- Content:
  - Full text and high-res image (if present).
  - Social stats:
    - Heart count and list of users who hearted (or top few + “and X more”).
  - Comments:
    - Linear list of comments with author avatar, text, timestamp.
    - Input box to add a new comment (for logged-in users).

### 3.6 User Settings & Dashboard (Private)

- Available to authenticated users only.
- Sections:
  - **Account Management**:
    - Link/unlink GitHub account.
  - **Active Project Settings**:
    - Change project name.
    - Change category.
    - Change which GitHub repo is tracked.
  - **Freeze Vault**:
    - See number of remaining freeze tokens.
    - View history of used tokens.
    - Activate a freeze for a given date.
  - **Timezone Reference**:
    - Show “App runs on UTC” message.
    - Display current UTC time and the user’s local time side-by-side.

---

## 4. Architecture & Data Notes

- The **overall architecture** remains the same as described in `DESIGN-DOC.md`:
  - Next.js frontend.
  - Node.js/TypeScript backend.
  - PostgreSQL database.
  - GitHub OAuth.
  - Firebase or similar for image storage.

### Note on Future Google Auth (V3)

- Support for **Google sign-in** is explicitly deferred to **V3+**.
- When introduced, onboarding will need to:
  - Allow users who sign in with Google to **add GitHub as a secondary connection**.
  - Handle repo authorization flows for GitHub separately from identity.
  - Cleanly merge accounts for users who first sign in with one provider and later link the other.
- V2 mostly adds:
  - New tables (`posts` if not already unified, `hearts`, `comments`, `freeze_tokens`, `projects`/`categories`).
  - New relations and queries for social features and streak computation.
  - Additional API endpoints for:
    - Creating manual posts.
    - Liking/unliking.
    - Creating/deleting comments.
    - Managing project settings and freeze tokens.

---

## 5. Success Criteria for V2

We can consider V2 successful when:

- Users can:
  - Log in, set up a project with a category and GitHub hook.
  - Post manual updates with text (and optionally images).
  - See their activity (auto + manual) contribute to a visible streak.
  - Understand their current streak status (Safe / At Risk / Frozen).
  - Heart and comment on others’ posts.
  - Browse categories and discover similar builders via the firehose.
- Observers can:
  - Visit any user’s profile and understand their journey at a glance via:
    - Streak count.
    - Consistency map.
    - Project mission.
- The system:
  - Applies the 48-hour rule and freeze tokens correctly.
  - Maintains data integrity between posts, hearts, comments, and streak calculations.

