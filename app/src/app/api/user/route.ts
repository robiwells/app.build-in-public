import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: {
    bio?: string;
    pinned_project_id?: string | null;
    pinned_activity_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const update: Record<string, unknown> = {};

  if (typeof body.bio === "string") {
    update.bio = body.bio.trim() || null;
  }

  // Pin/unpin project — verify ownership before pinning
  if ("pinned_project_id" in body) {
    const projectId = body.pinned_project_id ?? null;
    if (projectId !== null) {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.userId)
        .maybeSingle();
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
    update.pinned_project_id = projectId;
  }

  // Pin/unpin activity — verify ownership before pinning
  if ("pinned_activity_id" in body) {
    const activityId = body.pinned_activity_id ?? null;
    if (activityId !== null) {
      const { data: activity } = await supabase
        .from("activities")
        .select("id")
        .eq("id", activityId)
        .eq("user_id", user.userId)
        .maybeSingle();
      if (!activity) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }
    }
    update.pinned_activity_id = activityId;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update(update)
    .eq("id", user.userId);

  if (error) {
    console.error("PATCH /api/user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
