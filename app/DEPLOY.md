# Deploying the App

Instructions for deploying the 5 Minutes a Day app (Vercel + Supabase). Paths are relative to the **repo root** unless noted; when working from the `app/` directory, use `supabase/migrations/` and `.env.local` as local paths.

## Prerequisites

- Vercel account
- Supabase project
- GitHub OAuth App
- GitHub App (for auto-tracking commits; see section 5)

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/public key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (optional; app uses service role server-side)
   - Service role secret key → `SUPABASE_SECRET_KEY`
3. Run migrations from the **app** directory:

   ```bash
   cd app
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   Or apply the SQL in `app/supabase/migrations/` manually in the Supabase SQL editor.

## 2. GitHub OAuth App

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. New OAuth App:
   - **Homepage URL**: `https://<your-vercel-domain>`
   - **Authorization callback URL**: `https://<your-vercel-domain>/api/auth/callback/github`
3. Note **Client ID** → `GITHUB_ID` and generate **Client Secret** → `GITHUB_SECRET`.

## 3. Vercel

1. Import the repo. Set **Root Directory** to `app` if the Next.js app lives in `app/`.
2. Add environment variables:

   | Variable                              | Description                    |
   | ------------------------------------- | ------------------------------ |
   | `GITHUB_ID`                           | GitHub OAuth Client ID          |
   | `GITHUB_SECRET`                       | GitHub OAuth Client Secret     |
   | `NEXTAUTH_URL`                        | `https://<your-vercel-domain>` |
   | `NEXTAUTH_SECRET`                     | `openssl rand -base64 32`       |
   | `NEXT_PUBLIC_SUPABASE_URL`           | Supabase project URL           |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (optional)  |
   | `SUPABASE_SECRET_KEY`                | Supabase service role key      |

3. If using the GitHub App (section 5), add those variables as well.
4. Deploy.

## 4. Post-deploy checks

- Open `/` and confirm the global feed (or empty state).
- Sign in with GitHub; complete onboarding (Connect with GitHub App or pick repos).
- Confirm redirect to `/u/<username>`.
- Push a commit to a tracked repo; confirm an activity appears on `/` and on `/u/<username>`.
- Add or change repos under **Settings → Connectors** and confirm they update.

---

## 5. GitHub App (auto-tracking)

To let users track commits without adding a webhook themselves, create a **GitHub App** (separate from the OAuth App) and configure it as follows.

1. **Create app:** [GitHub → Developer settings → GitHub Apps → New GitHub App](https://github.com/settings/apps/new).
2. **Setup URL (after install):** `https://<your-vercel-domain>/api/github-app/setup`
3. **Webhook URL:** `https://<your-vercel-domain>/api/webhooks/github-app`
4. **Webhook secret:** Generate (e.g. `openssl rand -hex 32`) → `GITHUB_APP_WEBHOOK_SECRET`
5. **Permissions:** Repository → Contents: Read. Subscribe to **Push** (and optionally **Installation** / **installation_repositories**).
6. After creating: note **App ID** → `GITHUB_APP_ID`, generate **Private key** → `GITHUB_APP_PRIVATE_KEY`, and the app’s **URL slug** → `GITHUB_APP_SLUG`.

Add these to Vercel:

| Variable                     | Description                       |
| --------------------------- | --------------------------------- |
| `GITHUB_APP_ID`             | GitHub App ID                     |
| `GITHUB_APP_PRIVATE_KEY`    | PEM private key (newlines as `\n`) |
| `GITHUB_APP_WEBHOOK_SECRET` | Same as webhook secret in app     |
| `GITHUB_APP_SLUG`           | App URL slug (for Install App link) |

**Local testing:** Add the same variables to `.env.local` (in the app directory). When creating the GitHub App, set **Setup URL** to `http://localhost:3000/api/github-app/setup` and **Webhook URL** to `http://localhost:3000/api/webhooks/github-app` (or use a tunnel like ngrok). The “Connect with GitHub App” button on onboarding only appears when `GITHUB_APP_SLUG` is set.

**User flow:** Sign in (OAuth) → “Connect with GitHub App” → install app on repo → choose repo(s) and project → redirect to profile. Pushes are delivered via the app webhook; users do not configure a repo webhook.

**Runbook:** Ensure the GitHub App’s **Setup URL** and **Webhook URL** point at your production domain. After changing the app’s webhook URL or secret, update `GITHUB_APP_WEBHOOK_SECRET` in Vercel and redeploy if needed.

**GitHub App URL checklist (do not mix these up):**
- **Setup URL (Post installation):** `https://<domain>/api/github-app/setup` — where GitHub sends the user *after* they install the app (required for redirect and project creation).
- **Webhook URL:** `https://<domain>/api/webhooks/github-app` — where GitHub sends *push* and *installation* events (not the OAuth callback).
- **Callback URL** (in “Identifying and authorizing users”): only for OAuth; can be your homepage or leave as-is if you don’t use “Request user authorization during installation.”
