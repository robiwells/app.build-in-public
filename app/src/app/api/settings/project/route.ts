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
      active,
      project_repos!left(id, repo_full_name, repo_url, installation_id, active)
    `
    )
    .eq("user_id", user.userId)
    .eq("active", true)
    .eq("project_repos.active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: projects ?? [] });
}
