import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // Verify project exists
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, hearts_count")
    .eq("id", id)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check existing heart
  const { data: existing } = await supabase
    .from("project_hearts")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", id)
    .maybeSingle();

  if (existing) {
    await supabase.from("project_hearts").delete().eq("id", existing.id);
  } else {
    await supabase.from("project_hearts").insert({ user_id: userId, project_id: id });
  }

  // Read updated count
  const { data: updated } = await supabase
    .from("projects")
    .select("hearts_count")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    heartCount: updated?.hearts_count ?? 0,
    hearted: !existing,
  });
}
