import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getLocalToday } from "@/lib/date";

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = sessionUser.userId;

  let body: { content_text?: unknown; project_id?: unknown; content_image_url?: unknown; type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contentText = typeof body.content_text === "string" ? body.content_text.trim() : "";
  if (!contentText) {
    return NextResponse.json({ error: "content_text is required" }, { status: 400 });
  }

  const projectIdRaw = typeof body.project_id === "string" ? body.project_id.trim() : "";
  if (!projectIdRaw) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Ensure the project exists and belongs to the user
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectIdRaw)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found or you don't have access" }, { status: 400 });
  }

  const projectId = project.id;
  const contentImageUrl = typeof body.content_image_url === "string" ? body.content_image_url : null;

  const rawType = typeof body.type === "string" ? body.type : "manual";
  if (rawType !== "manual" && rawType !== "milestone") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const activityType: "manual" | "milestone" = rawType;

  // Fetch user timezone
  const { data: userRow } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const timezone = userRow?.timezone ?? "UTC";

  const now = new Date();
  const dateUtc = now.toISOString().slice(0, 10);
  const dateLocal = getLocalToday(timezone);

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      user_id: userId,
      project_id: projectId,
      type: activityType,
      content_text: contentText,
      content_image_url: contentImageUrl,
      date_utc: dateUtc,
      date_local: dateLocal,
      commit_count: 0,
      last_commit_at: now.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[posts] insert failed", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  return NextResponse.json(activity, { status: 201 });
}
