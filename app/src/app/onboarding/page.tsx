import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { RepoPicker } from "@/components/RepoPicker";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    redirect("/api/auth/signin?callbackUrl=/onboarding");
  }

  const supabase = createSupabaseAdmin();
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.userId)
    .limit(1);

  if (projects && projects.length > 0) {
    redirect(`/u/${user.username}`);
  }

  const token = (session as { accessToken?: string }).accessToken;
  if (!token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">
          No GitHub token. Please sign out and sign in again.
        </p>
      </main>
    );
  }

  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-red-600 dark:text-red-400">
          Failed to load repos from GitHub.
        </p>
      </main>
    );
  }

  const repos = await res.json();
  const publicRepos = (repos as { private?: boolean; full_name?: string; html_url?: string; name?: string }[])
    .filter((r) => !r.private)
    .map((r) => ({
      name: r.name ?? "",
      full_name: r.full_name ?? "",
      html_url: r.html_url ?? "",
    }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Choose a repo to track
      </h1>
      <RepoPicker repos={publicRepos} username={user.username} />
    </main>
  );
}
