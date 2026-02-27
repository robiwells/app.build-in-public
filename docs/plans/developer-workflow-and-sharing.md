# Future Plans: Developer Workflow & Sharing

Suggestions for making the Daily Log fit how developers actually work and how they want to share that work.

---

## Developer workflow

### 1. **Branch / PR context on activity**
- **Idea:** When an activity is created from a commit, optionally store and show **branch name** and **PR link** (if the commit is on a PR).
- **Why:** “Worked on `feature/auth`” or “Merged PR #12” is more meaningful than “3 commits” and helps others (and the author) see what actually happened.
- **Scope:** Enrich GitHub webhook payload → store `branch`, `pr_number`, `pr_url` (or similar) on `activities` / connector_metadata; display in `ActivityItem` and project feed.

### 2. **“Focus project” or default project**
- **Idea:** Let users set a **default project** (or “what I’m working on today”) so manual posts can default to that project and the feed/profile can highlight it.
- **Why:** Reduces friction when most work is in one project; makes “share my current work” one click.
- **Scope:** `users.default_project_id` or a small “Focus” control on projects; composer and quick-post default to it.

### 3. **Quick capture from the browser (e.g. bookmarklet or extension)**
- **Idea:** A “Log 5 min” bookmarklet or minimal browser extension: one click → open composer (or a minimal form) pre-filled with current project, or “Just log time” without picking a project.
- **Why:** Fits the “I just did 5 minutes, I want to log it now” moment without opening the full app.
- **Scope:** Small launcher page (e.g. `/log?project=...`) or extension that opens it; optional deep link into composer with project context.

### 4. **GitHub “work summary” or commit-message hints**
- **Idea:** Use the **first line of the last commit** (or a short summary of the day’s commits) as the visible “what I did” on the activity card, with optional override by the user.
- **Why:** Auto-generated activity text is more readable than “3 commits” and encourages better commit messages.
- **Scope:** Store or derive a `summary_text` per activity (from commit messages); show in feed and on project page; allow one-line edit in “Reconfigure” or a small “Edit summary” on the activity.

### 5. **Milestones tied to repo events (releases, tags, PR merge)**
- **Idea:** Treat **GitHub releases**, **tags**, or **merged PRs** as milestone candidates: user can “Promote to milestone” or we auto-create a milestone activity when a release is published.
- **Why:** Aligns “shipping” on the site with real shipping in the repo (releases/tags); fits the existing “Ship” / milestone concept in FUTURE.md.
- **Scope:** Webhook handlers for `release` / `pull_request` (merged); new activity type or flag “milestone” with link to release/PR; optional manual “Mark as milestone” on any activity.

### 6. **Daily digest or “today’s work” view**
- **Idea:** A **“Today”** view (or email/digest): “Your work today: project X (3 commits), project Y (1 post), streak N days.”
- **Why:** Matches the developer’s mental model of “what did I do today” and reinforces consistency.
- **Scope:** `/today` or a section on the home/profile page; optional daily email (see retention in FUTURE.md).

---

## Sharing work on the site

### 7. **Public project / post URLs that are easy to share**
- **Idea:** Ensure every project and post has a **stable, readable URL** (already partially there with slugs). Add **Open Graph / Twitter card** meta so links look good when shared on social or in chat.
- **Why:** When developers share “here’s my build-in-public project,” the preview should show title, description, and maybe streak or last activity.
- **Scope:** `metadata` / `openGraph` on project and post pages; optional image for OG (e.g. project card or user avatar).

### 8. **“Share” actions on project and post**
- **Idea:** Explicit **Share** button on project page and post detail: copy link, “Share to Twitter/X,” “Share to LinkedIn,” with pre-filled text (e.g. “Building X in public – N days so far”).
- **Why:** Reduces friction to share; consistent messaging and links.
- **Scope:** Share component with copy + optional social intents; store share text templates per context (project vs post).

### 9. **Embeddable project widget or badge**
- **Idea:** A small **embed** (iframe or image badge) for “I’m building in public” to put in README, personal site, or Twitter bio (e.g. “N-day streak” or “Last active: today”).
- **Why:** Developers already put “stars,” “follow,” and “blog” badges in READMEs; a “daily log” or “build in public” badge fits the same habit.
- **Scope:** `/api/embed/project/:id` or `/u/:username/badge` returning a small HTML snippet or image; optional query params for style (compact vs with streak).

### 10. **Profile as portfolio**
- **Idea:** **Profile page** as the main “portfolio” of build-in-public: highlight active project(s), streak, recent activity, and link to project pages. Optional “Featured projects” or “Pinned post” so users can curate what visitors see first.
- **Why:** Aligns “sharing my work” with “here’s my profile” instead of scattering links.
- **Scope:** Profile layout and sections (already partly there); optional “Pin project” / “Pin post”; optional short “About my build-in-public” blurb.

### 11. **“Ship” post and archive (from FUTURE.md)**
- **Idea:** As in FUTURE.md: **Ship** button for “I shipped this” with optional **Archive project** so the profile stays focused on current work while keeping the shipped journey visible (e.g. “Completed” section or separate URL).
- **Why:** Gives a clear “finish line” moment to share and a way to keep the profile from getting cluttered.
- **Scope:** Ship post type; archive/complete state for projects; feed/profile treatment for shipped vs active.

### 12. **RSS or public API for a project feed**
- **Idea:** **RSS feed** (or a simple public JSON feed) for a project’s activity so others can follow in a reader or pipe into their own tools.
- **Why:** Some developers prefer to follow via RSS; also enables “latest updates” on personal sites or dashboards.
- **Scope:** e.g. `/u/:username/projects/:project/feed.rss` and optionally `/feed.json`; cache and rate-limit.

---

## Summary table

| Area            | Idea                          | Fits workflow | Fits sharing |
|-----------------|--------------------------------|---------------|--------------|
| Workflow        | Branch/PR on activity          | ✓             | ✓            |
| Workflow        | Focus / default project        | ✓             | —            |
| Workflow        | Quick capture (bookmarklet)    | ✓             | —            |
| Workflow        | Commit-summary as activity text| ✓             | ✓            |
| Workflow        | Milestones from releases/PRs   | ✓             | ✓            |
| Workflow        | “Today” digest                 | ✓             | —            |
| Sharing         | OG / shareable URLs            | —             | ✓            |
| Sharing         | Share button + social intents  | —             | ✓            |
| Sharing         | Embed/badge for README         | —             | ✓            |
| Sharing         | Profile as portfolio           | —             | ✓            |
| Sharing         | Ship + archive project         | ✓             | ✓            |
| Sharing         | RSS / public project feed      | —             | ✓            |

These can be implemented incrementally; the ones that touch both workflow and sharing (branch/PR, commit summary, milestones, Ship) are especially high leverage for developers who both do the work and share it on the site.
