import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: rawProjects, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      slug,
      active,
      project_connector_sources!left(id, external_id, url, active, connector_type, user_connectors!inner(external_id))
    `
    )
    .eq("user_id", user.userId)
    .eq("active", true)
    .eq("project_connector_sources.active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/settings/project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Remap to backward-compatible shape expected by the client
  const projects = (rawProjects ?? []).map((p) => {
    const { project_connector_sources: sources, ...rest } = p as Record<string, unknown>;
    return {
      ...rest,
      project_repos: ((sources as Array<Record<string, unknown>>) ?? []).map((s) => ({
        id: s.id,
        connector_type: s.connector_type,
        repo_full_name: s.external_id,
        repo_url: s.connector_type === "medium"
          ? `https://medium.com/${s.external_id as string}`
          : s.url,
        installation_id: parseInt(((s.user_connectors as Record<string, unknown>)?.external_id as string) ?? "0", 10),
        active: s.active,
      })),
    };
  });

  return NextResponse.json({ projects });
}
