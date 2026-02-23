import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createInstallState } from "@/lib/github-app";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_setup: "Setup link expired or invalid. Try connecting with GitHub App again.",
  github_app: "Could not load repos from the GitHub App. Try again.",
  no_repos: "No repositories found for that installation. Install the app on a repo first.",
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const supabase = createSupabaseAdmin();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.userId)
    .eq("active", true)
    .maybeSingle();

  if (project) {
    redirect(`/u/${user.username}`);
  }

  const { error: errorCode } = await searchParams;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? "Something went wrong." : null;

  const appSlug = process.env.GITHUB_APP_SLUG;
  const installAppUrl =
    appSlug && user.userId
      ? `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(createInstallState(user.userId))}`
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Connect a repo to track
      </h1>
      {errorMessage && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{errorMessage}</p>
      )}
      {installAppUrl ? (
        <div>
          <a
            href={installAppUrl}
            className="inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Connect with GitHub App
          </a>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Install the app on a repo to track commits automatically—no webhook setup.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">GITHUB_APP_SLUG</code> and other GitHub App env vars in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">.env.local</code>. See <strong>docs/DEPLOY.md</strong> section 5.
        </p>
      )}
    </main>
  );
}
