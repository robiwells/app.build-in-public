import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { verifySetupToken, listInstallationRepos } from "@/lib/github-app";
import { createSupabaseAdmin } from "@/lib/supabase";
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

  // Fetch user's existing projects so RepoPicker can offer "add to existing"
  const supabase = createSupabaseAdmin();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", user.userId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
        GitHub connected
      </h1>
      <p className="mb-4 text-sm text-[#78716c]">
        Optionally add repos to a project to track commits on your activity feed. You can skip and add repos later from Settings.
      </p>
      <RepoPicker
        repos={repos}
        username={user.username}
        setupToken={token}
        existingProjects={(projects ?? []).map((p) => ({ id: p.id, title: p.title }))}
      />
    </main>
  );
}
