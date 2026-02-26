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

  // Get all GitHub connectors for this user
  const { data: userConnectors, error: connectorError } = await supabase
    .from("user_connectors")
    .select("id, external_id")
    .eq("user_id", user.userId)
    .eq("type", "github")
    .eq("active", true);

  if (connectorError) {
    return NextResponse.json({ error: connectorError.message }, { status: 500 });
  }

  const connectors = userConnectors ?? [];
  if (connectors.length === 0) {
    return NextResponse.json({ repos: [] });
  }

  const connectorIds = connectors.map((c) => c.id);

  // Get already-linked repos across this user's connectors
  const { data: linkedSources, error: linkedError } = await supabase
    .from("project_connector_sources")
    .select("external_id, project_id")
    .in("user_connector_id", connectorIds)
    .eq("connector_type", "github")
    .eq("active", true);

  if (linkedError) {
    return NextResponse.json({ error: linkedError.message }, { status: 500 });
  }

  const rows = linkedSources ?? [];
  const alreadyLinked = new Set(
    projectId
      ? rows.filter((r) => r.project_id !== projectId).map((r) => r.external_id)
      : rows.map((r) => r.external_id)
  );

  const repos: AvailableRepo[] = [];

  for (const connector of connectors) {
    const installationId = parseInt(connector.external_id, 10);
    if (!Number.isInteger(installationId)) continue;
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
      // Continue with other connectors
    }
  }

  return NextResponse.json({ repos });
}
