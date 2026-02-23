# V3 Spec: Multi-Provider Auth & Google + GitHub Linking

This document defines **V3**, which builds on top of:

- **V1**: GitHub-only auth, auto GitHub posts, global + user feeds (`V1-SPEC.md`).
- **V2**: Manual posts, social engine, streak logic, freeze tokens, richer screens (`V2-SPEC.md`).

V3’s focus is **identity and onboarding**:

- Add **Google sign-in** as a first-class auth provider.
- Allow users authenticated via **Google to connect GitHub** to track repos.
- Support **account linking/merging** between providers.
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

- Introduce (or formalize) a **`users`** table that is provider-agnostic:
  - `id` (internal UUID/int).
  - `display_name`.
  - `username` (for URLs).
  - `avatar_url`.
  - `email` (primary contact).
  - `created_at`, `updated_at`.

- Add a **`user_identities`** (or `auth_accounts`) table:
  - `id`.
  - `user_id` (FK → `users`).
  - `provider` (enum: `github`, `google`).
  - `provider_user_id` (e.g., GitHub user ID, Google subject).
  - `access_token` / `refresh_token` (encrypted/hashed or stored in vault).
  - `scopes` (optional).
  - `created_at`, `updated_at`.

- Users can have **1 or more identities**:
  - GitHub-only.
  - Google-only (initially; must connect GitHub to track repos).
  - Both GitHub + Google.

### 2.2 Represent Code Host Connections Explicitly

- Introduce a **`code_host_connections`** table (provider-agnostic):
  - `id`.
  - `user_id` (FK → `users`).
  - `provider` (enum: `github`, `bitbucket`, `gitlab`, …).
  - `provider_user_id` (e.g., GitHub numeric ID, Bitbucket UUID).
  - `provider_username`.
  - `access_token` / `refresh_token` (if stored).
  - `scopes` (e.g., repo/webhook scopes).
  - `created_at`, `updated_at`.

- Existing V1/V2 tracked repo logic should be adjusted to:
  - Reference `code_host_connections` instead of assuming repo access always comes from GitHub sign-in.
  - Allow a user who logged in with any identity provider (GitHub, Google, etc.) to still connect a code host for repos.

- **V3 implementation note**:
  - V3 ships with **GitHub** as the only supported code host provider, but uses the provider-agnostic model so **Bitbucket** (and others) can be added later without schema churn.

### 2.3 Projects / Tracked Repos

- Existing `projects` / `tracked_repos` model is updated to:
  - `id`.
  - `user_id`.
  - `code_host_connection_id` (FK → `code_host_connections`).
  - `provider` (enum mirroring `code_host_connections.provider`, e.g., `github`, `bitbucket`).
  - `repo_full_name` (provider-specific identifier; GitHub example: `owner/repo`).
  - `repo_url`.
  - `category` or `category_id` (from V2).
  - `active` (bool).
  - `created_at`, `updated_at`.

---

## 3. Login & Onboarding Flows (V3)

### 3.1 Login Gateway Screen

- Login screen now has **two options**:
  - “Continue with GitHub”.
  - “Continue with Google”.

- Behavior:
  - Both buttons ultimately result in:
    - Creating or finding a `user` row.
    - Creating or updating a `user_identities` row for that provider.
  - After login, we run **post-login routing** (see 3.3).

### 3.2 Provider-Specific OAuth Behavior

#### 3.2.1 GitHub Sign-In

- Largely unchanged from V1/V2, but now:
  - We create/update:
    - `user_identities` row with `provider = github`.
    - `code_host_connections` row with `provider = github` (if not exists) tied to this `user`.
  - We ensure there is **exactly one** `code_host_connections` row per user for `provider = github` (per GitHub account).

#### 3.2.2 Google Sign-In

- New in V3:
  - On successful Google OAuth:
    - Create/update `user_identities` row with `provider = google`.
    - **No code host connection is created yet**.
  - After login, route the user into an **onboarding state** that prompts them to connect a code host (GitHub in V3) if they want auto tracking.

### 3.3 Post-Login Routing Logic

After any login (GitHub or Google), run:

1. **Find or create user**
   - If provider identity already linked to a `user_id`, use it.
   - Otherwise:
     - See “Account Linking/Merging” (Section 4).

2. **Check code host connection**
   - If user has a `code_host_connections` row for `provider = github` **and** at least one `project`:
     - Redirect to:
       - `/` or `/u/:username` (as per V2 behavior).
   - If user has a `code_host_connections` row for `provider = github` **but no projects yet**:
     - Redirect to **Project Setup** (`/onboarding/project`).
   - If user has **no** `code_host_connections` row for `provider = github`:
     - Redirect to **Code Host Connection Onboarding** (`/onboarding/code-host`).

---

## 4. Account Linking & Merging

### 4.1 Linking a Second Provider

#### 4.1.1 From GitHub-first to Google

- User originally signed up with GitHub, now clicks “Link Google account” in Settings:
  - Redirect to Google OAuth.
  - On success:
    - Create `user_identities` row with `provider = google` and `user_id` = current user.
  - No merging needed; identity simply attaches to the same `user`.

#### 4.1.2 From Google-first to GitHub

- User originally signed up with Google, now:
  - Onboarding (`/onboarding/code-host`) offers a “Connect GitHub” button (V3), and may later offer other code hosts (e.g., Bitbucket).
  - Or Settings offers a “Connect GitHub” action (and later other code hosts).
- Flow:
  - Redirect to GitHub OAuth.
  - On success:
    - If there is no existing `code_host_connections` row for this user with `provider = github`:
      - Create `code_host_connections` row with `provider = github`.
      - Create `user_identities` row with `provider = github` for this `user`.
    - If another user already has a `code_host_connections` row with `provider = github` and this `provider_user_id`:
      - See merging rules (4.2).

### 4.2 Merging Rules

#### 4.2.1 Preferred Approach (Simple)

- **Assumption for V3**:
  - We can avoid complex merges by:
    - Disallowing two fully separate users from being merged automatically.
    - Instead, show a clear error if a GitHub account already belongs to a different user.

- Behavior:
  - If a Google-auth’d user tries to connect a GitHub account that’s already attached to another `user`:
    - Show UI message:
      - “This GitHub account is already linked to another 5 Minutes a Day account. Please sign out and log in with GitHub, or contact support to merge.”
    - No automatic merge.

#### 4.2.2 Optional Manual Merge (Future)

- V3 can define but not fully implement:
  - Admin tooling or explicit “merge accounts” flow.
  - For now, treat this as an **out-of-scope operational process**.

---

## 5. Onboarding Changes

### 5.1 Code Host Connection Onboarding (`/onboarding/code-host`)

- For users **without** a `code_host_connections` row for `provider = github`:
  - Explain:
    - “To track your work automatically, connect a code host.”
    - In V3, the only available option is GitHub.
  - Show a **“Connect GitHub”** button (V3):
    - Redirects to GitHub OAuth with necessary scopes.
  - Once GitHub is connected:
    - Proceed to Project Setup (`/onboarding/project`).

### 5.2 Project Setup (`/onboarding/project`)

- Same project setup as in V2:
  - Project name.
  - Category picker.
  - Repo selection from connected code host account:
    - Uses `code_host_connections` (GitHub in V3) to query repos.
    - Allows toggling auto-tracking.

- The key V3 change:
  - This step is now **agnostic to initial identity provider**:
    - For GitHub-first users: happens immediately after login if no projects exist.
    - For Google-first users: happens after GitHub connection onboarding.

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
  - Store OAuth tokens securely (encrypted or in a secrets store).
  - Implement refresh flows where applicable (especially for Google).

- **Scopes**:
  - For GitHub (V3 code host):
    - Request minimal scopes required for:
      - Reading repos / webhooks.
      - Receiving commit events.
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

## 8. Success Criteria for V3

V3 is successful when:

- Users can:
  - Sign up with either GitHub **or** Google.
  - Link the missing provider later from Settings.
  - Sign in with either provider and land on the same account (no duplicates).
  - If they start with Google, connect GitHub and then:
    - Select repos.
    - See auto-generated posts in feeds as before.

- The system:
  - Stores identities and connections in a normalized way (`users`, `user_identities`, `code_host_connections`).
  - Keeps all V1/V2 functionality working regardless of whether the initial login was GitHub or Google.
  - Properly handles edge cases where a GitHub account is already in use by another user (no silent merges).

