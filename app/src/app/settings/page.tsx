import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin/github?callbackUrl=/settings");
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId) redirect("/api/auth/signin/github?callbackUrl=/settings");

  const supabase = createSupabaseAdmin();
  const { data: project } = await supabase
    .from("projects")
    .select("repo_full_name, repo_url")
    .eq("user_id", user.userId)
    .eq("active", true)
    .maybeSingle();

  const token = (session as { accessToken?: string }).accessToken;
  if (!token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">
          No GitHub token. Please sign out and sign in again to change repo.
        </p>
      </main>
    );
  }

  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const repos = res.ok
    ? ((await res.json()) as { private?: boolean; full_name?: string; html_url?: string; name?: string }[])
        .filter((r) => !r.private)
        .map((r) => ({
          name: r.name ?? "",
          full_name: r.full_name ?? "",
          html_url: r.html_url ?? "",
        }))
    : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Current tracked repo:{" "}
        {project ? (
          <a
            href={project.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {project.repo_full_name}
          </a>
        ) : (
          "None"
        )}
      </p>
      <SettingsForm
        repos={repos}
        currentRepo={project?.repo_full_name ?? null}
        username={user.username ?? ""}
      />
    </main>
  );
}
