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
  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      slug,
      active,
      project_repos!left(id, repo_full_name, repo_url, installation_id, active)
    `
    )
    .eq("user_id", user.userId)
    .eq("active", true)
    .eq("project_repos.active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/settings/project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ projects: projects ?? [] });
}
