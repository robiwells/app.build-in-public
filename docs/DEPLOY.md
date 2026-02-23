# Deploying Build in Public (V1)

## Prerequisites

- Vercel account
- Supabase project
- GitHub OAuth App
- GitHub repo with webhook (for the repo you track)

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY`
3. Run migrations from the `app` directory:

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

1. Import the repo (or use the `app` directory as root if the repo root is the monorepo).
2. Set **Root Directory** to `app` if the Next.js app lives in `app/`.
3. Add environment variables:

   | Variable                     | Description                          |
   | --------------------------- | ------------------------------------ |
   | `GITHUB_ID`                 | GitHub OAuth Client ID               |
   | `GITHUB_SECRET`             | GitHub OAuth Client Secret           |
   | `NEXTAUTH_URL`              | `https://<your-vercel-domain>`      |
   | `NEXTAUTH_SECRET`           | `openssl rand -base64 32`            |
   | `NEXT_PUBLIC_SUPABASE_URL`  | Supabase project URL                 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key   |
   | `SUPABASE_SECRET_KEY`       | Supabase secret key                  |
   | `GITHUB_WEBHOOK_SECRET`     | Secret you set when creating the webhook |

4. Deploy.

## 4. GitHub Webhook (per tracked repo)

1. In the GitHub repo: **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://<your-vercel-domain>/api/webhooks/github`
3. **Content type**: `application/json`
4. **Secret**: generate a random string (e.g. `openssl rand -hex 32`) and set it as `GITHUB_WEBHOOK_SECRET` in Vercel.
5. **Events**: choose **Just the push event**.
6. Save.

## 5. Post-deploy checks

- Open `/` and confirm the global feed (or empty state).
- Sign in with GitHub; complete onboarding (pick a repo).
- Confirm redirect to `/u/<username>`.
- Push a commit to the tracked repo (or send a test webhook from GitHub).
- Confirm an activity appears on `/` and on `/u/<username>`.
- Change the tracked repo under **Settings** and confirm it updates.
