# V4 Spec: Multi-Provider Auth & Google + GitHub Linking

This document defines **V4**, which builds on top of:

- **V1**: GitHub OAuth sign-in, auto GitHub posts (via webhooks), global + user feeds (`V1-SPEC.md`).
- **V2 and V3**: Project spaces, manual posts, social engine (hearts, comments), streak logic, streak freeze, richer screens (`V2-SPEC.md`, `V3-PART-A-SPEC.md`, `V3-PART-B-SPEC.md`).

**Current state (before V4):**

- **Sign-in** is GitHub-only (NextAuth with GitHub provider). Session has `userId` (= `users.id`), `username`. The `users` table is keyed by `github_id` (one user per GitHub account).
- **Connecting GitHub for repo tracking is already decoupled from sign-in.** Users sign in with GitHub OAuth, then separately “connect” repos via the **GitHub App** installation flow: `/onboarding` (“Connect with GitHub App”) or Settings → Connectors → GitHub. Repo access is stored in `user_github_installations` (user_id, installation_id) and `project_repos` (per-project, per-repo). So identity (who you are) and which repos are tracked are already separate flows.

V4’s focus is **identity and onboarding**:

- Add **Google sign-in** as a first-class auth provider.
- Allow users authenticated via **Google** (or any future provider) to **connect GitHub** via the existing GitHub App flow to track repos—no change to how repo connection works.
- Support **account linking/merging** between providers (e.g. link Google to an existing GitHub-signed-up account).
- Keep the rest of the product (posts, social, streaks) functionally the same.

---

## 1. Goals & Non-Goals

### 1.1 Goals

- **Reduce friction to sign up** by letting users start with Google or GitHub.
- **Decouple identity from repo access**:
  - Identity provider (Google/GitHub) is independent from **which code host account/repos** are connected for tracking.
- **Handle linking/merging cleanly**:
  - If a user starts with GitHub, they can later add Google (and vice versa) without duplicate accounts or data loss.
- **Preserve v1/v2 behavior**:
  - All existing posting, feed, streak, and social behavior should continue to work unchanged once a user has at least one tracked repo.

### 1.2 Non-Goals

- No new social features, streak rules, or gamification.
- No support yet for **non-GitHub project sources** (e.g., Strava, Figma) beyond what is already in future docs.
- No multi-account switching per code host in this version (one connected account per provider, per user).

---

## 2. Conceptual Model Changes

### 2.1 Separate “User Identity” from “Auth Provider”

- **Current:** `users` has `id`, `github_id`, `username`, `avatar_url`, `bio`, `timezone`, `streak_*`, etc. One user per GitHub account (sign-in upserts by `github_id`).

- **V4:** Evolve to a provider-agnostic identity model:
  - **`users`** remains the central record but becomes provider-agnostic (no longer require `github_id` for creation):
    - `id`, `username` (for URLs), `avatar_url`, `email` (optional), `display_name` (optional), plus existing fields (`bio`, `timezone`, `streak_*`, etc.). `github_id` may remain for backward compatibility or migration.
  - Add **`user_identities`** (or `auth_accounts`):
    - `id`, `user_id` (FK → `users`), `provider` (`github` | `google`), `provider_user_id`, optional tokens/scopes, `created_at`, `updated_at`.
  - Users can have **1 or more identities**: GitHub-only, Google-only, or both.

### 2.2 Code Host Connections (Repo Tracking)

- **Current:** Repo tracking is already decoupled from sign-in. **GitHub App** installations are stored in `user_github_installations` (user_id, installation_id). Repos are linked to projects via **`project_repos`** (project_id, user_id, installation_id, repo_full_name, repo_url, active). There is no OAuth “code host” token stored for repo access—the GitHub App and webhooks handle commit events.

- **V4 option A (minimal):** Keep current model. Google (and any new auth provider) users simply use the same **GitHub App** flow to connect repos (Settings → Connectors → GitHub, or onboarding). No new tables required for “code host connection”; identity is the only change.

- **V4 option B (formalized):** Introduce a **`code_host_connections`** table (e.g. one row per user per GitHub App installation, or per connected account) and have `project_repos` reference it. This is a schema evolution for future multi–code-host support (Bitbucket, etc.); not required for “Google sign-in + connect GitHub” to work.

### 2.3 Projects / Tracked Repos

- **Current:** `projects` (user_id, title, description, url, active, category) and **`project_repos`** (project_id, user_id, installation_id, repo_full_name, repo_url, active). No `code_host_connection_id` today.

- **V4:** Either keep this schema (option A) or, if introducing `code_host_connections` (option B), add `code_host_connection_id` to `project_repos` and derive installation_id from that. Category and active already exist from V2/V3.

---

## 3. Login & Onboarding Flows (V4)

### 3.1 Login Gateway Screen

- **Current:** Single option: “Continue with GitHub” (e.g. `SignInModal`, `callbackUrl=/onboarding`).

- **V4:** Login screen has **two options**:
  - “Continue with GitHub”.
  - “Continue with Google”.

- Behavior for both:
  - Create or find a `user` row and create/update the corresponding `user_identities` row.
  - After login, run **post-login routing** (see 3.3).

### 3.2 Provider-Specific OAuth Behavior

#### 3.2.1 GitHub Sign-In

- **Current:** NextAuth GitHub provider; sign-in callback upserts `users` by `github_id`, sets session `userId` and `username`. Repo access is **not** created at sign-in; user must complete **GitHub App** installation (onboarding or Settings) to track repos.
- **V4:** Same idea. Create/update `user_identities` with `provider = github`. Do **not** assume repo access from sign-in; user connects repos via the existing GitHub App flow. If we introduce `code_host_connections`, we could create or link one when the user first completes a GitHub App install.

#### 3.2.2 Google Sign-In

- **New in V4:** On successful Google OAuth, create/update `user_identities` with `provider = google`. No repo connection is created. After login, route into onboarding that prompts connecting GitHub (via GitHub App) if they want auto tracking.

### 3.3 Post-Login Routing Logic

**Current:** After GitHub sign-in, redirect to `callbackUrl` (e.g. `/onboarding`). Onboarding page checks for existing active `project_repos`; if none, shows “Connect with GitHub App”. After App install, user is sent to repo picker (`/onboarding/github-app`) or can go to `/u/:username`.

**V4:** After any login (GitHub or Google):

1. **Find or create user** (and link identity); see Section 4 for linking/merging.
2. **Check repo tracking:**
   - If user has at least one active **project_repos** (or equivalent): redirect to `/` or `/u/:username`.
   - If user has **user_github_installations** (or a GitHub code host connection) but no projects/repos yet: redirect to **project/repo setup** (e.g. `/onboarding` or `/onboarding/github-app` as today).
   - If user has **no** GitHub connection yet: redirect to **connect-GitHub onboarding** (e.g. `/onboarding` with copy that explains “Connect GitHub to track repos”).

---

## 4. Account Linking & Merging

### 4.1 Linking a Second Provider

#### 4.1.1 From GitHub-first to Google

- User originally signed up with GitHub, now clicks “Link Google account” in Settings:
  - Redirect to Google OAuth.
  - On success: Create `user_identities` row with `provider = google` and `user_id` = current user. No merging needed.

#### 4.1.2 From Google-first to GitHub (for sign-in identity)

- User signed up with Google and wants to also use GitHub to sign in (same account):
  - Settings offers “Link GitHub account” (OAuth). On success, create `user_identities` row with `provider = github` for this `user`. Repo tracking is still separate (GitHub App); linking GitHub identity does not by itself add repos.

#### 4.1.3 Connecting GitHub for repos (already in product)

- **Current:** “Connecting GitHub” for repo tracking is done via **GitHub App** (onboarding or Settings → Connectors → GitHub), not OAuth. This does not create a second “identity”; it adds `user_github_installations` and then the user can add `project_repos`. No change in V4 beyond ensuring Google-signed-in users can use the same flow.

### 4.2 Merging Rules

#### 4.2.1 Preferred Approach (Simple)

- **V4:** No automatic merging of two separate users. If a user tries to link a provider (e.g. GitHub) that is already linked to a different `user`, show a clear error; do not merge. Repo connection (GitHub App) is per-user. When linking identity, if the provider account is already attached to another user, show a clear UI message and do not merge.

#### 4.2.2 Optional Manual Merge (Future)

- For V4: Admin or explicit merge-accounts flow is out of scope.

---

## 5. Onboarding Changes

### 5.1 Connect Repos (current: `/onboarding`)

- **Current:** Users without active `project_repos` go to `/onboarding`, which shows Connect with GitHub App (GitHub App install link). After install, callback records `user_github_installations` and redirects to `/onboarding/github-app` to pick repos. No OAuth code-host token; repo access is via the App.
- **V4:** Same flow. Copy should clarify that connecting GitHub is for tracking commits; sign-in identity is already set. Google-signed-in users use the same GitHub App flow.

### 5.2 Repo / Project Setup (current: `/onboarding/github-app` and profile)

- **Current:** After GitHub App install, user lands on `/onboarding/github-app` (repo picker). They add repos to existing projects or create new ones; project management is also on profile (`/u/:username`) and Settings.
- **V4:** No change. This step is agnostic to identity provider (GitHub or Google); both use the same GitHub App and repo picker.

---

## 6. UI/UX Surface Changes

### 6.1 Login & Settings

- **Login Screen**:
  - Two buttons:
    - “Continue with GitHub”.
    - “Continue with Google”.

- **Settings / Account Management**:
  - Show connected providers:
    - GitHub: connected/not connected.
    - Google: connected/not connected.
  - Allow:
    - Linking a missing provider.
    - Unlinking a provider (with guardrails if it’s the only provider).
  - Clarify:
    - GitHub is required for auto-tracking repos.
    - Google is optional but convenient for login.

### 6.2 Minor Copy Updates

- Update copy across onboarding screens to:
  - Avoid equating “login with GitHub” with “tracking with GitHub”.
  - Instead:
    - Identity = how you log in.
    - Code host connection = how the system reads your work.

---

## 7. Data & Security Considerations

- **Tokens**:
  - **Current:** No stored OAuth tokens for repo access; GitHub App + webhooks handle commits. NextAuth session only.
  - **V4:** Store identity-provider OAuth tokens (Google, and optionally GitHub when used for sign-in) securely; implement refresh where applicable (especially for Google).

- **Scopes**:
  - For GitHub **sign-in** (OAuth): minimal identity scopes (e.g. read:user). Repo access uses **GitHub App** (installations, webhooks), not OAuth repo scopes.
  - For future code hosts (e.g., Bitbucket):
    - Request minimal scopes required to list repos and receive push/commit events.
  - For Google:
    - Minimal identity scopes (profile, email).

- **Deletion & Unlinking**:
  - Unlinking a provider should:
    - Remove/disable its `user_identities` row and tokens.
    - Not delete core user data (posts, streaks) associated with the `user`.
  - Deleting a user account should:
    - Clean up identities, connections, and projects as defined by your data retention policy.

---

## 8. Success Criteria for V4

V4 is successful when:

- Users can:
  - Sign up with either GitHub **or** Google.
  - Link the missing provider later from Settings.
  - Sign in with either provider and land on the same account (no duplicates).
  - If they start with Google, connect GitHub via the existing GitHub App flow and then:
    - Select repos (same as today).
    - See auto-generated posts in feeds as before.

- The system:
  - Stores identities in a normalized way (`users`, `user_identities`). Repo connection remains as today (`user_github_installations`, `project_repos`) unless `code_host_connections` is introduced.
  - Keeps all existing functionality working regardless of whether the initial login was GitHub or Google.
  - Properly handles edge cases where a provider account is already linked to another user (no silent merges).

