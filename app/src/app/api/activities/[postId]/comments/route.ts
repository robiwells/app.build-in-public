import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: activity } = await supabase
    .from("activities")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: string;
  try {
    const json = await req.json();
    body = typeof json?.body === "string" ? json.body.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: "Body must be 1000 characters or fewer" }, { status: 400 });
  }

  const { data: comment, error: insertErr } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, body })
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .single();

  if (insertErr || !comment) {
    console.error("POST /api/activities/[postId]/comments error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const u = (comment as Record<string, unknown>).users as Record<string, unknown> | null;
  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        user: u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null,
      },
    },
    { status: 201 }
  );
}
