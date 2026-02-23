# GitHub App–Based Auto Tracking — Implementation Plan

> **Goal:** Track commits automatically without users configuring a webhook. Users install a GitHub App on the repo they want to track; push events are delivered to our app and drive the same activity feed as today.

**Auth vs repo connection (two separate steps):**

- **Sign-in (auth only):** We use **GitHub OAuth** (existing NextAuth flow) purely for identity. The user signs in with GitHub; we create/update a user record and a session. No repo access or app install is required at this step.
- **Connect repo (separate step):** After sign-in, the user chooses “Connect a repo” or “Track a repo.” That triggers the **GitHub App install** flow: they install our app on one or more repos; we get an installation and create/update a project linked to their **already-authenticated** user. Push events from the app are then tied to that user via the project, not via the OAuth token.

So: **GitHub is used for auth only at login;** the **GitHub App is used only for repo connection and push delivery.** This keeps identity (who the user is) decoupled from which integration they connect (which repo to track). That design **paves the way for adding other login providers** (e.g. Google, email) later: we’d add another OAuth provider or credential flow for sign-in, while “Connect a repo” remains the GitHub App step for users who want to track a GitHub repo. Users who sign in with Google could still connect a GitHub repo via the same Install App flow; the session/user id from any provider would be used in the Setup callback state.

**Context:** Current v1 uses a **repository webhook** (user adds it manually). This plan switches to a **GitHub App**: user signs in with GitHub (OAuth, unchanged), then “connects” a repo by **installing the app** on it. GitHub sends push events to the app’s webhook; we look up the project by `repository.full_name` and upsert activities as today. No per-repo webhook setup by the user.

**Architecture:** Keep existing OAuth (NextAuth), Supabase, and activity model. Add: (1) a GitHub App (separate from the OAuth App), (2) an “Install App” flow that ends at a Setup callback and creates/updates a project, (3) a single webhook endpoint that handles both **push** (activity upsert) and **installation** (optional cleanup). App authentication uses the app’s private key to obtain installation access tokens when calling the GitHub API (e.g. to list repos after install).

**Spec reference:** `docs/V1-SPEC.md`. This plan extends v1; it does not replace the existing webhook—you can support both (app-only or app + legacy webhook) as desired.

**Future: other login providers.** Because auth (OAuth) and repo connection (GitHub App) are separate, you can later add Google, email, or other sign-in methods without changing the “Connect repo” flow. The only requirement is that the authenticated user has a stable `user_id` (or equivalent) to put in the Setup callback state; that can come from any provider. Repo tracking remains GitHub-specific until you add other integrations (e.g. GitLab app, manual “add project”).

---

## Phase 1: GitHub App and configuration

### Task 1: Create the GitHub App (manual)

**Where:** [GitHub → Settings → Developer settings → GitHub Apps → New GitHub App](https://github.com/settings/apps/new).

**Steps:**

1. **Name, URL, callback**
   - **Name:** e.g. `Build in Public` (or your app name).
   - **Homepage URL:** `https://<your-production-domain>`.
   - **Callback URL:** Leave blank (we use Setup URL for install flow).
   - **Setup URL (after install):** `https://<your-domain>/api/github-app/setup`. User is redirected here after choosing repos; we receive `installation_id` and can pass `state` (signed user id) in the install link.

2. **Webhook**
   - **Active:** Yes.
   - **Webhook URL:** `https://<your-domain>/api/webhooks/github-app` (dedicated route for app webhooks; keep existing `/api/webhooks/github` if you still support legacy repo webhooks).
   - **Webhook secret:** Generate a random string (e.g. `openssl rand -hex 32`). Store as `GITHUB_APP_WEBHOOK_SECRET`.

3. **Permissions**
   - **Repository permissions:**
     - **Contents:** Read (required for Push events).
   - **Subscribe to events:** **Push**, and optionally **Installation** / **installation_repositories** (for install/uninstall and repo add/remove).

4. **Where can this app be installed?**
   - “Only on this account” or “Any account” as needed.

5. **Create the app.** Then:
   - **App ID** → `GITHUB_APP_ID`.
   - **Generate a private key** (PEM) → store contents as `GITHUB_APP_PRIVATE_KEY` (or path in env). Keep secret.
   - **Client ID** (shown on app settings) → `GITHUB_APP_CLIENT_ID` (only needed if you use app-level OAuth; for install flow the install URL uses the app slug).

6. **Install URL format:**  
   `https://github.com/apps/<APP_SLUG>/installations/new?state=<STATE>`  
   `APP_SLUG` is the app’s “URL slug” in the app settings. `STATE` is a signed/short-lived value encoding the current user id (so the Setup callback knows which user completed the install).

**Deliverable:** App created; `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET` (and optionally `GITHUB_APP_CLIENT_ID` / slug) documented for env.

---

### Task 2: Env and docs

**Files:**
- Update `app/.env.local.example` and `docs/DEPLOY.md`.

**Steps:**

1. Add to `.env.local.example`:
   - `GITHUB_APP_ID` — GitHub App ID.
   - `GITHUB_APP_PRIVATE_KEY` — PEM string (or path to PEM file); newlines can be `\n`.
   - `GITHUB_APP_WEBHOOK_SECRET` — Same secret as in the app’s webhook configuration.
   - `GITHUB_APP_SLUG` — App URL slug (for building install URL).

2. In `docs/DEPLOY.md`, add a section “GitHub App (auto-tracking)” that describes creating the app, configuring webhook and Setup URL, and setting these env vars in Vercel.

**Commit:** `chore: env and docs for GitHub App`

---

## Phase 2: Install flow (Setup callback and “Connect repo”)

### Task 3: JWT and installation token helper

**Files:**
- Create `app/src/lib/github-app.ts` (or equivalent).

**Steps:**

1. **App JWT:**  
   Implement a function that builds a JWT for the GitHub App (algorithm RS256, claims: `iat`, `exp` (e.g. 10 min), `iss`: `GITHUB_APP_ID`) signed with `GITHUB_APP_PRIVATE_KEY`. Use Node `crypto` or a small JWT library. GitHub docs: “Authenticating with GitHub Apps” / “Generating a JWT.”

2. **Installation access token:**  
   Implement a function that, given `installation_id`, uses the app JWT to call `POST /app/installations/:installation_id/access_tokens`, then returns the `token` from the response. This token is used for API calls on behalf of that installation (e.g. list repos).

3. **List repos for installation:**  
   Using the installation token, call `GET /installation/repositories` and return the list of repo names/full_name/html_url as needed for the UI.

**Commit:** `feat(github-app): JWT and installation token helpers`

---

### Task 4: Setup callback route (post-install)

**Files:**
- Create `app/src/app/api/github-app/setup/route.ts` (or `page.ts` if you want a full page).

**Steps:**

1. **Handle GET (redirect from GitHub):**  
   GitHub redirects to `Setup URL?installation_id=...&setup_action=install`. Query may include `state` if you append it to the install URL (recommended).

2. **State:**  
   If you use `state`, verify and decode it to get the **user id** (e.g. signed with `NEXTAUTH_SECRET` or a dedicated key). If state is missing or invalid, redirect to sign-in or home with an error.

3. **Resolve user:**  
   Ensure the user is authenticated (e.g. session cookie) and matches the user id from state. If not, redirect to sign-in.

4. **Get installation token:**  
   Call the helper from Task 3 with `installation_id` from the query.

5. **List repos:**  
   Use the installation token to fetch repositories accessible to this installation. If the app is installed on “selected repos,” the list is already limited by the user’s choice.

6. **Create/update project (v1: one repo per user):**  
   For v1, either:
   - Auto-select the first repo (or the only one), or  
   - Render a small page “Choose repo to track” and POST to an API that creates the project.  
   Create or update the `projects` row for this user (same as current onboarding: one project per user, `repo_full_name`, `repo_url`). Optionally store `installation_id` on `projects` for future use (e.g. uninstall handling).

7. **Redirect:**  
   Redirect to `/u/:username` or onboarding as in the current flow.

**Commit:** `feat(github-app): Setup callback and project creation after install`

---

### Task 5: “Connect repo” entry point (Install App link)

**Files:**
- Update onboarding and/or settings UI.

**Steps:**

1. **Install URL builder:**  
   In code, build the GitHub Install App URL:  
   `https://github.com/apps/<GITHUB_APP_SLUG>/installations/new?state=<SIGNED_USER_ID>`.

2. **State:**  
   Before redirecting, create a short-lived, signed value that encodes the current user’s id (and optionally nonce). Store the same value in a signed cookie if the Setup callback does not receive `state` from GitHub (some flows do not pass query params back; then you can match by session + installation_id in a temporary store).

3. **Onboarding / Settings:**  
   Replace or supplement “Pick a repo from list” (OAuth repo list) with a primary CTA: “Connect with GitHub App” (or “Track a repo”) that sends the user to the Install App URL. You can keep the existing “pick from OAuth list” as a fallback and create the project the same way; the only difference is how the repo is chosen (install flow vs list).

4. **Copy:**  
   Clarify in UI that installing the app lets the product track commits automatically and does not require adding a webhook.

**Commit:** `feat(github-app): Add Install App link to onboarding/settings`

---

## Phase 3: Webhook for GitHub App (push and installation)

### Task 6: Webhook endpoint for the app

**Files:**
- Create `app/src/app/api/webhooks/github-app/route.ts`.

**Steps:**

1. **Signature verification:**  
   Read raw body; verify using `X-Hub-Signature-256` and `GITHUB_APP_WEBHOOK_SECRET` (same as existing webhook verification). Return 401 if invalid.

2. **Event dispatch:**  
   Read `X-GitHub-Event`. For `push`, call the same activity upsert logic you use today (by `repository.full_name`). For `installation`, handle `action` (e.g. `deleted`, `created`) as in Task 7. Respond 200 quickly after parsing and dispatching (do heavy work asynchronously if needed).

3. **Push handling:**  
   Parse payload: `repository.full_name`, `commits` (with timestamps). Look up project by `repo_full_name`; if found, call existing `processPushEvent` (or equivalent) so one row per user per UTC day is updated. No need for installation_id in the DB for push—lookup by repo is enough.

4. **Idempotency:**  
   Keep current behavior: multiple pushes the same day merge into one activity row per user/date.

**Commit:** `feat(webhook): GitHub App webhook endpoint and push handling`

---

### Task 7: Installation events (optional cleanup)

**Files:**
- Same route as Task 6; optionally `app/src/lib/github-app.ts` or a small handler module.

**Steps:**

1. **installation.created:**  
   Optional: if you stored pending installation data (e.g. installation_id + repos) and only create projects when the user hits the Setup callback, you can ignore `created` or use it to prefill. For the minimal flow (create project only in Setup callback), no DB change needed on `created`.

2. **installation.deleted:**  
   If you store `installation_id` on `projects`, mark those projects inactive or delete them when `action === 'deleted'` and `installation.id` matches. Otherwise, no-op (user can remove the repo from the app’s list; we don’t get a per-repo “removed” unless we use `installation_repositories`).

3. **installation_repositories (optional):**  
   If you subscribe to it, on `removed` you can deactivate the project for that repo when it’s removed from the installation.

**Commit:** `feat(webhook): Handle installation deleted for GitHub App`

---

## Phase 4: Docs and deploy

### Task 8: Update deployment and runbooks

**Files:**
- `docs/DEPLOY.md`, optionally `README.md` or a short “Auto-tracking” doc.

**Steps:**

1. Document that production uses the GitHub App for auto-tracking; list env vars and that the app’s webhook and Setup URL must point to production.

2. Add a short “User flow” subsection: sign in → Connect repo (Install App) → select repo (or auto) → redirect to profile; pushes appear without adding a webhook.

3. Note that the legacy repository webhook (`/api/webhooks/github`) can remain for repos that already have it; app and webhook can coexist (both look up by `repo_full_name` and upsert activities).

**Commit:** `docs: GitHub App auto-tracking deployment and flow`

---

### Task 9: Manual test and success criteria

**Checklist:**

- Create the GitHub App and configure webhook + Setup URL.
- Sign in (OAuth), click “Connect with GitHub App,” complete install on a test repo.
- Land on Setup callback; project is created for the chosen repo; redirect to profile.
- Push a commit to that repo; within a short time, activity appears on `/` and `/u/:username`.
- Uninstall the app (or remove repo from app); optional: project is deactivated or removed.
- No manual webhook setup is required on the user’s repo.

**Commit:** Any final fixes as `fix: GitHub App flow …`.

---

## Execution summary

| Phase | Tasks   | Description |
|-------|---------|-------------|
| 1     | 1–2     | Create GitHub App, env vars, and docs |
| 2     | 3–5     | JWT/installation token, Setup callback, Install App link in UI |
| 3     | 6–7     | App webhook endpoint (push + installation events) |
| 4     | 8–9     | Deployment docs and manual verification |

**Dependencies:** Existing v1 (OAuth, Supabase, projects/activities, current webhook or `processPushEvent`-style logic). No change to feed APIs or pages except where you add the “Connect with GitHub App” CTA.

**References:**
- [GitHub: Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/creating-a-github-app)
- [GitHub: Authenticating with GitHub Apps (JWT, installation token)](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
- [Webhook events and payloads (push, installation)](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads)
