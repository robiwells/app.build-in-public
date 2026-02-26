# Medium Connector Spec: RSS Ingestion

This spec defines the implementation of a **Medium RSS ingestion** feature. Because Medium’s official API is deprecated, the system will use **public RSS feeds** to sync long-form content into a project’s activity feed. It builds on the existing connector layer (`user_connectors`, `project_connector_sources`, `activities` with `connector_source_id` and `connector_metadata`).

---

## Accuracy review (vs current project)

- **Schema:** Matches. `user_connectors` (type, external_id, display_name), `project_connector_sources` (connector_type, external_id, url, display_name, user_connector_id), and `activities` (connector_source_id, connector_metadata, content_text, content_image_url, type, date_utc, date_local, last_commit_at) are as described. Idempotency via `connector_metadata->>'article_url'` is correct (activities have no `external_id` column).
- **Type constraint:** Correct. `activities_type_check` currently allows only `('auto_github', 'manual', 'milestone')`; migration must add `'auto_medium'`.
- **XP:** The function `activity_xp_delta(act_type, cnt)` has `ELSE 1`, so `auto_medium` would get 1 XP by default. Optionally add an explicit `WHEN 'auto_medium' THEN 5` (or 1) in a migration.
- **Gaps to address in implementation:**
  1. **Project/profile source lists:** Queries currently filter with `.eq("project_connector_sources.connector_type", "github")`. To show Medium sources in the project's "repos/sources" list, remove this filter or extend to include `'medium'` (e.g. show all connector types and label by type).
  2. **Feed and Medium card:** The feed does **not** currently select `connector_metadata` from activities. For the Medium card to show "Read on Medium" (article URL), the feed must select `connector_metadata` and the `FeedItem.activity` type must include it (e.g. `connector_metadata?: ...`). ActivityItem will need a branch for `type === 'auto_medium'` and access to `activity.connector_metadata`.
  3. **Display URL for source:** In `project_connector_sources`, `url` is used to store the **RSS feed URL** for the cron worker. The feed currently maps `repo_url = connectorSource.url`, so that would show the RSS URL. For Medium, the "source" link (e.g. "via @username") should point to the profile or publication page. Either: (a) derive it (e.g. `https://medium.com/@username` or `https://medium.com/publication-slug` from `external_id`), or (b) add an optional `display_url` column and use that when present.

---

## 1. Objective

- Let users **link a Medium profile or publication** to a project (no OAuth; public feed only).
- **Periodically poll** the public RSS feed and create `auto_medium` activity rows for new articles.
- Show Medium articles in the same activity feed as commits and manual posts, with a distinct **Medium activity card** (title, date, thumbnail, “Read on Medium” link).

---

## 2. Relationship to Existing Schema

The feature uses the **existing** connector tables; no new tables are required.

| Layer | Table | Usage for Medium |
|-------|--------|-------------------|
| User connection | `user_connectors` | One row per user’s “Medium” link: `type = 'medium'`, `external_id = '@username'` (or a canonical identifier). No tokens; feed is public. |
| Project source | `project_connector_sources` | One row per project–Medium link: `connector_type = 'medium'`, `external_id` = username or publication slug, `url` = RSS feed URL, `display_name` = feed title from RSS. |
| Activity | `activities` | `type = 'auto_medium'`, `connector_source_id` = FK to `project_connector_sources`, `connector_metadata` = JSONB (see §5). **Idempotency** uses `connector_metadata->>'article_url'` (no separate `external_id` column on activities). |

**Schema change required:** Extend the `activities.type` check constraint to allow `'auto_medium'` (migration: drop and re-add `activities_type_check` to include `'auto_medium'`).

---

## 3. Data Models & Field Mapping

### 3.1 `user_connectors`

- **`type`**: `'medium'`
- **`external_id`**: Normalised identifier, e.g. `@username` for profiles or `publication-slug` for publications (no leading `@`).
- **`display_name`**: Optional; can be set from feed `<title>` after first fetch.
- No OAuth; no credentials stored.

### 3.2 `project_connector_sources`

- **`connector_type`**: `'medium'`
- **`external_id`**: Same as user input (e.g. `@robiwells` or `my-publication`).
- **`url`**: The **RSS feed URL** (see §4) so the worker can fetch without recomputing.
- **`display_name`**: Human-readable label (e.g. “Rob’s blog” or publication name from feed).
- **`user_connector_id`**: FK to the `user_connectors` row for this user’s Medium link (create one per user if not exists when they add their first Medium source).

### 3.3 `activities`

- **`type`**: `'auto_medium'`
- **`connector_source_id`**: FK to `project_connector_sources.id` for this Medium source.
- **`project_id`**, **`user_id`**: From the connector source’s project and user.
- **`date_utc`** / **`date_local`**: From the article’s published date (local date derived using project owner’s timezone).
- **`content_text`**: Optional snippet (e.g. first ~200 chars, HTML stripped) for card preview.
- **`content_image_url`**: Optional thumbnail from first `<img>` in content/description.
- **`connector_metadata`**: JSONB per §5; must include **`article_url`** for idempotency.

---

## 4. Feed Discovery & Validation

### 4.1 RSS URL Rules

- **User profile:** Input starts with `@` → strip `@` and use  
  `https://medium.com/feed/@<username>`  
  Example: `@robiwells` → `https://medium.com/feed/@robiwells`
- **Publication:** Input is a slug (no `@`) → use  
  `https://medium.com/feed/<slug>`  
  Example: `my-publication` → `https://medium.com/feed/my-publication`

### 4.2 Validation Before Saving

- Before creating or updating a `project_connector_sources` row, perform a **pre-flight** request (HEAD or GET) to the constructed RSS URL.
- If the response is not 2xx or the body is not valid RSS/XML, do **not** save the source; return a clear error (e.g. “Feed not found or invalid”).
- Optional: Parse the feed once and show the **latest article title** in the UI as immediate feedback (“Feed linked: latest post is ‘…’”).

### 4.3 Input Validation (recommended: Zod)

- Normalise input: trim, optional leading `@` for profiles.
- **Profile:** pattern like `@?[a-zA-Z0-9_-]+` (or Medium’s actual rules if documented).
- **Publication:** slug, no `@`; pattern like `[a-zA-Z0-9_-]+`.
- Reject empty, overly long, or invalid characters so RSS URLs are always well-formed.

---

## 5. `connector_metadata` Schema for Medium

Each `auto_medium` activity must store at least:

| Key | Type | Description |
|-----|------|-------------|
| `article_url` | string | **Required.** Stable article URL for idempotency. Prefer `<link>` (strip `?source=...` query) or `<guid>` (Medium uses `https://medium.com/p/<id>`). See Appendix A. |
| `title` | string | Article title from `<title>` (CDATA). |
| `published_at` | string | ISO 8601 derived from `<pubDate>` (RFC 2822 in feed). |
| `thumbnail_url` | string \| null | First *content* image from `content:encoded`; exclude 1×1 tracking pixels. See Appendix A. |
| `snippet` | string \| null | Plain-text snippet (~200 chars), HTML stripped from `content:encoded` or `description`. |

Optional: `guid`, `author` (from `<dc:creator>`), `categories` (array of `<category>`).

---

## 6. Ingestion Worker (Cron)

### 6.1 Trigger

- **Vercel Cron** (or Supabase Edge Function / external worker) **Note:** Vercel Hobby allows only one run per day; the app uses `0 12 * * *` (daily at 12:00 UTC). Pro can use more frequent schedules (e.g. every 2 hours).
- Route: e.g. `GET /api/cron/ingest-medium` protected by `CRON_SECRET` or Vercel’s cron auth.

### 6.2 Algorithm

1. **Select sources:** Query all rows from `project_connector_sources` where `connector_type = 'medium'` and `active = true`. Join to `projects` and `users` to get `project_id`, `user_id`, and user `timezone`.
2. **Fetch:** For each source, GET `url` (RSS feed). Use a reasonable timeout and handle failures (log, skip, retry later).
3. **Parse:** Use a standard RSS/XML parser (e.g. `rss-parser` in Node). Extract items (title, link, guid, pubDate, content:encoded, description). See **Appendix A** for actual Medium RSS structure.
4. **Idempotency:** For each item, set `article_url` = `<link>` with query params stripped (or use `<guid>`; Medium’s guid is `https://medium.com/p/<id>`). Check for existing activity: `connector_source_id = source.id` AND `connector_metadata->>'article_url' = article_url`; if exists, skip.
5. **Process each new item:**
   - **Title / Link:** From `<title>` (CDATA) and `<link>`.
   - **Published date:** Parse `<pubDate>` (RFC 2822, e.g. `Wed, 11 Feb 2026 02:11:21 GMT`) to ISO; derive `date_utc` and `date_local` (user timezone).
   - **Snippet:** First ~200 characters of `content:encoded` or `description`, HTML stripped.
   - **Thumbnail:** First `<img src="...">` in `content:encoded` that is *not* a 1×1 tracking pixel (Medium appends `<img src="https://medium.com/_/stat?..." width="1" height="1">`); prefer images from `cdn-images-1.medium.com`. Store in `content_image_url` and `connector_metadata.thumbnail_url`.
   - Build `connector_metadata` per §5.
   - Insert one `activities` row: `type = 'auto_medium'`, `connector_source_id`, `project_id`, `user_id`, `date_utc`, `date_local`, `content_text`, `content_image_url`, `connector_metadata`, `last_commit_at` = published_at (for feed ordering).

### 6.3 Limits & Robustness

- Cap items per source per run (e.g. only process latest 10–20) to avoid backfill storms.
- On parse or DB errors, log and continue with other sources; do not fail the entire job.

---

## 7. UI Requirements

### 7.1 Connectors Page (`/connectors`)

- Add a **Medium** section below (or beside) GitHub.
- **No “Connect with Medium” OAuth.** Use a single control: **“Link Medium feed.”**
- **Input:** One text field: “Medium username or publication slug” with placeholder e.g. `@username` or `publication-slug`.
- **Validation:** On submit, compute RSS URL, run pre-flight request, optionally fetch and parse once. On success, create or reuse `user_connectors` (type `medium`, `external_id` = normalised input) and show success message; optionally show “Latest post: \<title\>”.
- **Errors:** “Feed not found”, “Invalid username or slug”, etc.

### 7.2 Adding Medium to a Project

- From the project’s “sources” / “repos” area (same place GitHub repos are added), allow **“Add Medium feed.”**
- If the user has no `user_connectors` row for Medium yet, either:
  - Redirect to Connectors to add one, or
  - Inline the same “username or publication slug” input and create `user_connector` + `project_connector_sources` in one step.
- After adding, the new source appears in the project’s source list (e.g. “Medium: @user” or “Medium: Publication Name”). Use `display_name` from feed when available.

### 7.3 Activity Rendering: Medium Card

- In the activity feed (global, user, project), when `activity.type === 'auto_medium'`:
  - Render a **Medium-specific card** (not the commit-style block).
  - **Display:** Article title (link to `connector_metadata.article_url` or `connector_metadata.link`), publication date, thumbnail (if present), optional snippet.
  - **CTA:** “Read on Medium” linking to the article URL.
  - **Visual distinction:** Use a book icon or Medium “M” / brand colour so it’s clearly not a commit. Reuse existing feed layout (e.g. same card container as manual/milestone) for consistency.

### 7.4 Feed / Profile Consistency

- Medium activities must appear in the same feeds as other activities (global, user profile, project page), ordered by `last_commit_at` (or equivalent) so articles and commits are interleaved by time.
- Use `project_connector_sources.display_name` (or `external_id`) when showing “source” under the activity (e.g. “via My Publication”).

---

## 8. Success Criteria

1. **Link flow:** A user can enter `@username` (or a publication slug) on the Connectors page or when adding a source to a project; the system validates the RSS URL and creates `user_connectors` and `project_connector_sources` with the correct `url` and `external_id`.
2. **Ingestion:** After the first cron run, the last N articles (e.g. 10) from the feed appear as `auto_medium` activities in the database for that project.
3. **Idempotency:** Re-running the worker does not create duplicate activities for the same article (same `connector_source_id` + `article_url` in `connector_metadata`).
4. **Freshness:** New articles published after the source is linked appear in the feed within the configured polling interval (once per day on Hobby; more frequent on Vercel Pro if the schedule is changed).
5. **Feed UX:** Medium articles render with the dedicated Medium card (title, date, thumbnail, “Read on Medium”), and are visually distinct from commit-based activity.

---

## 9. Out of Scope (for this spec)

- Medium OAuth or authenticated API.
- Editing or deleting ingested articles from our DB when they’re removed on Medium (soft delete or “removed” state could be a later enhancement).
- Full-text search over article content.
- Zod schema is recommended for input validation but not mandated in this spec; implement as needed for the link flow.

---

## 10. Implementation Checklist

- [ ] Migration: extend `activities_type_check` to include `'auto_medium'`.
- [ ] Migration (optional): extend `activity_xp_delta()` with `WHEN 'auto_medium' THEN 5` (or 1); else default 1 applies.
- [ ] Feed discovery: helper to build RSS URL from `@username` or `slug`; pre-flight validation.
- [ ] API: endpoint to “link” Medium (validate + create `user_connectors` and optionally `project_connector_sources`).
- [ ] Project sources: UI + API to add a Medium source to a project (create `project_connector_sources`; reuse or create `user_connectors`).
- [ ] **Project/profile queries:** Extend or remove the filter `.eq("project_connector_sources.connector_type", "github")` so Medium sources appear in the project source list; label by connector type in the UI.
- [ ] **Feed:** Add `connector_metadata` to the activities select and to `FeedItem.activity` type so the Medium card can read `article_url`.
- [ ] **Source link in feed:** For Medium, use a display URL for the "repo" link (e.g. derive `https://medium.com/<external_id>` from `external_id` when connector_type is medium, or add `display_url`).
- [ ] Cron route: `GET /api/cron/ingest-medium` (or equivalent) implementing §6.
- [ ] RSS parsing: parse feed, extract title, link, pubDate, description/content, first image.
- [ ] Idempotency: check `(connector_source_id, connector_metadata->>'article_url')` before insert.
- [ ] Connectors page: Medium section with “Link Medium feed” input and validation.
- [ ] Activity card: Medium-specific branch in ActivityItem (or component) for `type === 'auto_medium'`, using `activity.connector_metadata` for title/link/thumbnail.
- [ ] Optional: Zod schema for username/publication slug and RSS URL derivation.

---

## Appendix A: Medium RSS structure (real feed example)

The following is derived from a live Medium user feed (e.g. `https://medium.com/feed/@example_writer`). Use it to implement parsing and idempotency correctly.

### Channel (feed) level

| Element | Example / notes |
|--------|------------------|
| `channel/title` | CDATA: e.g. `Stories by Jane Smith on Medium` — use for `display_name` when saving the source. |
| `channel/link` | Profile/publication URL with optional `?source=rss-...`. |
| `channel/lastBuildDate` | RFC 2822. |
| `atom:link[@rel="self"]` | Feed URL (e.g. `https://medium.com/@example_writer/feed`). |

### Item (article) level

| Element | Example / notes |
|---------|------------------|
| `item/title` | CDATA: article title. |
| `item/link` | Full article URL, e.g. `https://medium.com/@example_writer/my-article-slug-...?source=rss-...`. **For idempotency:** use this and strip the `?source=...` query, or use `guid`. |
| `item/guid` | `isPermaLink="false"`, value e.g. `https://medium.com/p/dd48514dce4e`. Stable per article; good for dedup. |
| `item/pubDate` | RFC 2822: `Wed, 11 Feb 2026 02:11:21 GMT`. Parse to ISO 8601 for `published_at` and activity dates. |
| `item/atom:updated` | ISO 8601. Optional; prefer `pubDate` for “published” time. |
| `item/dc:creator` | CDATA: author name (e.g. `Jane Smith`). Optional for `connector_metadata.author`. |
| `item/category` | Multiple; CDATA (e.g. `hiking`, `outdoors`). Optional for `connector_metadata.categories`. |
| `item/content:encoded` | CDATA with full HTML. **Thumbnail:** first `<figure><img … src="https://cdn-images-1.medium.com/..."></figure>` or first `<img src="...">` that is not the tracking pixel. **Tracking pixel:** Medium appends `<img src="https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=..." width="1" height="1" alt="">` — skip any 1×1 image or URL containing `/_/stat`. **Snippet:** strip all HTML, then take first ~200 characters. |
| `item/description` | Sometimes present; alternative for snippet if `content:encoded` is empty. |

### Namespaces

- `xmlns:content="http://purl.org/rss/1.0/modules/content/"` → `content:encoded`
- `xmlns:dc="http://purl.org/dc/elements/1.1/"` → `dc:creator`
- `xmlns:atom="http://www.w3.org/2005/Atom"` → `atom:link`, `atom:updated`

Parsers that support these (e.g. `rss-parser` in Node) will expose `content:encoded`, `dc:creator`, and `guid`; ensure the chosen parser handles them.
