import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { verifySetupToken, listInstallationRepos } from "@/lib/github-app";
import { RepoPicker } from "@/components/RepoPicker";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function OnboardingGitHubAppPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const { token } = await searchParams;
  const installationId = verifySetupToken(token ?? null);
  if (installationId === null) {
    redirect("/onboarding?error=invalid_setup");
  }

  let repos: { name: string; full_name: string; html_url: string }[];
  try {
    repos = await listInstallationRepos(installationId);
  } catch {
    redirect("/onboarding?error=github_app");
  }

  if (repos.length === 0) {
    redirect("/onboarding?error=no_repos");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Choose a repo to track
      </h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Commits will be tracked automatically—no webhook setup needed.
      </p>
      <RepoPicker repos={repos} username={user.username} setupToken={token} />
    </main>
  );
}
