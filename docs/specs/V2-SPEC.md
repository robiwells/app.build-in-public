# V2 Spec: Project Spaces

This document defines **V2**, which builds directly on top of V1 (`V1-SPEC.md`).

V2 introduces **project spaces**: a lightweight organisational layer that lets users group tracked repos under named projects. In V1, users had exactly one tracked repo. V2 lifts that restriction and gives users a first-class "project" concept they own and curate.

---

## 1. Relationship to V1

- **V1 (current)**:
  - Multi-user GitHub OAuth.
  - One tracked repo per user (`projects` table with `unique(user_id)`).
  - Auto-generated, per-day activity posts based on commits.
  - Public, read-only global feed (`/`) and per-user feeds (`/u/:username`).

- **V2 (this spec)** adds:
  - A user can create **multiple projects**.
  - Each project has a **title** (required), **description**, **URL**, and **zero or more tracked repos**.
  - Users manage projects from their **profile page** (`/u/:username`).
  - Activity posts are associated with a project, and the feeds display the project context.

All new features **extend the V1 data model** rather than rewriting it.

---

## 2. Core Concepts

### 2.1 What Is a Project?

A **project** represents a distinct effort or product a user is building in public. Examples:

- "My SaaS app" — with two repos: `frontend` and `backend`.
- "Learning Rust" — with one repo of exercises.
- "Writing a book" — with no repos yet (placeholder for future manual tracking).

### 2.2 Project Properties

| Field         | Required | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| `title`       | Yes      | Short name for the project (e.g. "Build in Public App").           |
| `description` | No       | One or two sentences about what the project is.                    |
| `url`         | No       | External link (e.g. a live site, landing page, or docs URL).       |
| `repos`       | No       | Zero or more connected GitHub repos tracked under this project.    |

### 2.3 Repos Within a Project

- Each connected repo belongs to **exactly one project** (a repo cannot be shared across projects).
- A project can have **zero repos** (useful as a placeholder or for projects that don't have a repo yet).
- Repos are tracked via GitHub App installation, same as V1. The `installation_id`, `repo_full_name`, and `repo_url` fields move from the current `projects` table into a dedicated `project_repos` table.

---

## 3. User Flows

### 3.1 Existing User (Migration from V1)

- On first load after the V2 migration:
  - The system silently migrates the user's existing tracked repo into a **default project** titled with the repo name (e.g. `"app.build-in-public"`).
  - No user action required. Existing activity posts retain their `project_id` reference.
  - The user can rename or reorganise later.

### 3.2 Creating a New Project

- From the profile page (`/u/:username`), an authenticated user clicks **"New Project"**.
- A form appears with:
  - **Title** (required).
  - **Description** (optional).
  - **URL** (optional).
- On save, the project is created with zero repos. The user can add repos afterward.

### 3.3 Adding Repos to a Project

- From a project's detail/edit view, the user clicks **"Add Repo"**.
- A searchable list of repos from their GitHub App installation is displayed (same mechanism as V1 onboarding).
- The user selects one or more repos. Each is linked to the project.
- Repos already assigned to another project are shown as disabled with a label indicating which project they belong to.

### 3.4 Editing a Project

- The user can update a project's title, description, and URL at any time from the profile page or a project settings view.
- The user can remove a repo from a project (the repo becomes untracked; future commits are not recorded until it is re-assigned).

### 3.5 Deleting a Project

- The user can delete a project.
- Deleting a project:
  - Unlinks all associated repos (they become untracked).
  - **Does not delete** historical activity posts — they remain visible in the feed with the project title preserved for display purposes.
- If the user's only project is deleted, their profile shows an empty state prompting them to create a new one.

### 3.6 Onboarding (New Users)

- The V1 onboarding flow is updated:
  - After GitHub App installation and repo selection, the system creates a **default project** using the selected repo's name as the title.
  - The user can customise the project title, description, and URL on the next step (or skip and edit later).
- The overall flow remains: Sign in → Install GitHub App → Select repo(s) → Land on profile.

### 3.7 Anonymous Visitor

- No changes to the anonymous experience beyond display:
  - Feed items now show the **project title** alongside the repo name.
  - User profile pages display a list of the user's projects with their repos underneath.

---

## 4. Data Model Changes

### 4.1 Updated `projects` Table

The `projects` table becomes the **project space** entity. Repo-specific fields are extracted to `project_repos`.

```
projects
  id              uuid        PK, default gen_random_uuid()
  user_id         uuid        FK → users(id) ON DELETE CASCADE, NOT NULL
  title           text        NOT NULL
  description     text        nullable
  url             text        nullable
  active          boolean     NOT NULL DEFAULT true
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

Key changes from V1:
- **Remove** the `unique(user_id)` constraint (users can now have many projects).
- **Remove** `repo_full_name`, `repo_url`, `installation_id` (moved to `project_repos`).
- **Add** `title`, `description`, `url`.

### 4.2 New `project_repos` Table

Each row represents a single tracked repo linked to a project.

```
project_repos
  id                uuid        PK, default gen_random_uuid()
  project_id        uuid        FK → projects(id) ON DELETE CASCADE, NOT NULL
  user_id           uuid        FK → users(id) ON DELETE CASCADE, NOT NULL
  installation_id   bigint      NOT NULL
  repo_full_name    text        NOT NULL
  repo_url          text        NOT NULL
  active            boolean     NOT NULL DEFAULT true
  created_at        timestamptz NOT NULL DEFAULT now()
  updated_at        timestamptz NOT NULL DEFAULT now()

  UNIQUE(user_id, repo_full_name)
```

- `user_id` is denormalised here for efficient querying (find all repos for a user without joining through projects).
- The unique constraint on `(user_id, repo_full_name)` ensures a repo is only tracked once per user.

### 4.3 Updated `activities` Table

- The existing `project_id` FK on `activities` continues to reference `projects(id)`.
- **New**: change the unique constraint from `unique(user_id, date_utc)` to `unique(user_id, project_id, date_utc)` — a user can now have activity on the same day across multiple projects.
- **New**: add `project_repo_id` (FK → `project_repos(id)`, nullable) to link an activity post to the specific repo that generated it.

### 4.4 Updated Webhook Processing

- When a push event arrives, the webhook handler:
  1. Looks up the repo in `project_repos` by `installation_id` + `repo_full_name`.
  2. Resolves the parent `project_id`.
  3. Upserts the activity record using `(user_id, project_id, date_utc)` as the conflict key (and sets `project_repo_id`).

### 4.5 Migration Strategy

A single migration handles the transition:

1. **Add** `title`, `description`, `url` columns to `projects`.
2. **Populate** `title` on existing rows using the `repo_full_name` (e.g. extract the repo name portion).
3. **Create** the `project_repos` table.
4. **Copy** each existing project's `repo_full_name`, `repo_url`, `installation_id`, `user_id` into a corresponding `project_repos` row.
5. **Drop** the `unique(user_id)` constraint on `projects`.
6. **Drop** `repo_full_name`, `repo_url`, `installation_id` columns from `projects`.
7. **Make** `title` NOT NULL after backfill.
8. **Alter** the unique constraint on `activities` from `(user_id, date_utc)` to `(user_id, project_id, date_utc)`.
9. **Add** `project_repo_id` column to `activities` (nullable FK to `project_repos`).

All existing data is preserved. Feed queries continue to work because `activities.project_id` still points to a valid `projects` row.

---

## 5. API Changes

### 5.1 New Endpoints

| Method   | Route                          | Description                                      |
|----------|--------------------------------|--------------------------------------------------|
| `GET`    | `/api/projects`                | List the authenticated user's projects.           |
| `POST`   | `/api/projects`                | Create a new project.                            |
| `PATCH`  | `/api/projects/:id`            | Update a project's title, description, or URL.   |
| `DELETE` | `/api/projects/:id`            | Delete a project (unlinks repos, keeps history). |
| `GET`    | `/api/projects/:id/repos`      | List repos linked to a project.                  |
| `POST`   | `/api/projects/:id/repos`      | Add a repo to a project.                         |
| `DELETE` | `/api/projects/:id/repos/:repoId` | Remove a repo from a project.                |

### 5.2 Updated Endpoints

| Route                            | Change                                                            |
|----------------------------------|-------------------------------------------------------------------|
| `GET /api/feed`                  | Include `project.title` in response alongside repo name.          |
| `GET /api/feed/u/:username`      | Include `project.title` in response; optionally filter by project.|
| `POST /api/github-app/project`   | Create a project + link repos (updated to use new schema).        |
| `PATCH /api/settings/project`    | Update project fields (updated to use new schema).                |
| `GET /api/repos`                 | Indicate which project (if any) each repo is assigned to.         |

### 5.3 Webhook Handler

- `POST /api/webhooks/github-app` — updated to resolve repos via `project_repos` instead of `projects`.

---

## 6. UI Changes

### 6.1 Profile Page (`/u/:username`)

- **Projects section**: a list of the user's projects, each showing:
  - Title.
  - Description (if set).
  - URL link (if set).
  - List of tracked repos under the project.
  - Latest activity summary.
- **Authenticated user** sees:
  - "New Project" button.
  - Edit/delete controls on each project.
  - "Add Repo" action within each project.

### 6.2 Feed Cards (Global & User)

- Activity cards now display:
  - **Project title** as the primary label (e.g. "Build in Public App").
  - Repo name as secondary context (e.g. "app.build-in-public").
  - Everything else (avatar, commit count, timestamp, link) remains the same.

### 6.3 Onboarding

- After GitHub App installation and repo selection:
  - A new step (or inline form) lets the user name their first project.
  - Defaults to the repo name. User can change it or skip.
  - Description and URL are optional fields shown here.

### 6.4 Settings

- The existing settings page is updated to manage projects rather than a single tracked repo:
  - List of projects with edit/delete.
  - Within each project, manage linked repos.

---

## 7. Explicit Non-Goals for V2

The following remain **out of scope**:

- **Manual posts**: no text composer or image uploads.
- **Social interactions**: no hearts, comments, or social graph.
- **Streak logic**: no streak states, freeze tokens, or grace rules.
- **Categories**: no project categorisation or feed filtering.
- **Multi-provider auth**: GitHub OAuth only.
- **Repo sharing across projects**: each repo belongs to exactly one project.

---

## 8. Success Criteria for V2

V2 is successful when:

- Users can:
  - Create multiple projects from their profile page.
  - Give each project a title, description, and URL.
  - Assign one or more repos to each project.
  - See activity posts grouped by project in feeds.
  - Edit or delete projects without losing historical activity data.

- New users:
  - Go through onboarding and have a default project created automatically.

- The system:
  - Correctly routes webhook events to the right project and repo.
  - Handles the V1 → V2 data migration seamlessly (no manual user action required).
  - Maintains backward compatibility — existing feeds, user profiles, and activity data continue to work.
