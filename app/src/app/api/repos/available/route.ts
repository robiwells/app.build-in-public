import { auth } from "@/lib/auth";
import { listInstallationRepos } from "@/lib/github-app";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export type AvailableRepo = {
  full_name: string;
  html_url: string;
  installation_id: number;
};

/**
 * GET /api/repos/available
 * Returns repos from the user's GitHub App installation(s) that can be linked.
 * - Without ?projectId: repos not linked to any project (for create flow).
 * - With ?projectId=xxx: repos not linked to any other project (so current project
 *   repos appear and can be kept or removed when editing).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  const supabase = createSupabaseAdmin();

  // Get installation_ids and repo_full_name; when editing, include project_id so we exclude only repos linked to *other* projects
  const { data: existingRepos, error: existingError } = await supabase
    .from("project_repos")
    .select("installation_id, repo_full_name, project_id")
    .eq("user_id", user.userId)
    .eq("active", true);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const rows = existingRepos ?? [];
  const alreadyLinked = new Set(
    projectId
      ? rows.filter((r) => r.project_id !== projectId).map((r) => r.repo_full_name)
      : rows.map((r) => r.repo_full_name)
  );

  // Installation IDs from repos already linked to projects, plus any from connector flow (user_github_installations)
  const fromProjectRepos = [
    ...new Set(rows.map((r) => r.installation_id).filter(Boolean)),
  ] as number[];
  const { data: userInstallations } = await supabase
    .from("user_github_installations")
    .select("installation_id")
    .eq("user_id", user.userId);
  const fromUserInstallations = (userInstallations ?? [])
    .map((r) => r.installation_id)
    .filter((id): id is number => typeof id === "number");
  const installationIds = [...new Set([...fromProjectRepos, ...fromUserInstallations])];

  if (installationIds.length === 0) {
    return NextResponse.json({ repos: [] });
  }

  const repos: AvailableRepo[] = [];

  for (const installationId of installationIds) {
    try {
      const list = await listInstallationRepos(installationId);
      for (const r of list) {
        if (!alreadyLinked.has(r.full_name)) {
          repos.push({
            full_name: r.full_name,
            html_url: r.html_url,
            installation_id: installationId,
          });
        }
      }
    } catch (err) {
      console.error("[repos/available] listInstallationRepos failed", { installationId, err });
      // Continue with other installations
    }
  }

  return NextResponse.json({ repos });
}
