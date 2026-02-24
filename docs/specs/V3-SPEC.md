# V3 Spec: Full “5 Minutes a Day” Experience

This document is the **overview** for the next-stage product built on top of the V1/V2 GitHub auto-feed. V3 is split into **two parts** so it’s easier to build and ship incrementally.

---

## Build order

| Part | Focus | Doc |
|------|--------|-----|
| **Part A** | Manual check-ins, unified post model, streaks, freeze tokens, profile streak dashboard, settings | [V3-PART-A-SPEC.md](./V3-PART-A-SPEC.md) |
| **Part B** | Hearts, comments, category filter, post detail thread, login gateway | [V3-PART-B-SPEC.md](./V3-PART-B-SPEC.md) |

Build **Part A first**, then **Part B**. Part B assumes Part A is done (posts, streaks, project categories).

---

## What V3 adds (summary)

- **Content**
  - Manual text/image check-ins in addition to auto GitHub activity.
  - Unified “post” view (manual + auto) in global and profile feeds.

- **Streaks & grace**
  - 48-hour rule (streak doesn’t reset on first missed day).
  - Status: Safe / At Risk / Frozen.
  - Freeze tokens to protect a day.

- **Social (Part B)**
  - Hearts on posts.
  - Comments and post detail thread (`/p/:postId`).
  - Category filter on the global feed.

- **Screens**
  - Landing with composer (auth) and feed.
  - Profile with streak dashboard and consistency map.
  - Post detail with comments.
  - Settings: account, project/category, freeze vault, timezone.

---

## Relationship to V1/V2

- **V1/V2:** Multi-user GitHub OAuth, auto activity from commits, global + per-user feeds, projects + repos.
- **V3** extends that with manual posts, streak logic, and (in Part B) hearts, comments, and category filtering. Reuse the existing data model where possible; extend rather than rewrite.

---

## Success criteria (full V3)

- Users can post manually (text ± image) and see manual + auto in feeds; activity counts toward streaks.
- 48-hour rule and freeze tokens work as specified; profile shows streak and consistency map.
- Users can heart and comment; guests get a login prompt when they try to interact.
- Category filter and post detail thread work; data stays consistent.

For **Part A** and **Part B** success criteria, see the respective spec docs.
