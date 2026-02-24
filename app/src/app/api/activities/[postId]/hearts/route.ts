import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // Verify post exists
  const { data: activity, error: actErr } = await supabase
    .from("activities")
    .select("id, hearts_count")
    .eq("id", postId)
    .maybeSingle();

  if (actErr || !activity) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Check existing heart
  const { data: existing } = await supabase
    .from("hearts")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase.from("hearts").delete().eq("id", existing.id);
  } else {
    await supabase.from("hearts").insert({ user_id: userId, post_id: postId });
  }

  // Read updated count
  const { data: updated } = await supabase
    .from("activities")
    .select("hearts_count")
    .eq("id", postId)
    .maybeSingle();

  return NextResponse.json({
    heartCount: updated?.hearts_count ?? 0,
    hearted: !existing,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;

  const supabase = createSupabaseAdmin();

  const { data: activity } = await supabase
    .from("activities")
    .select("hearts_count")
    .eq("id", postId)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { data: hearts } = await supabase
    .from("hearts")
    .select("user_id, users(id, username, avatar_url)")
    .eq("post_id", postId);

  const users = (hearts ?? []).map((h: Record<string, unknown>) => {
    const u = h.users as Record<string, unknown> | null;
    return u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null;
  }).filter(Boolean);

  const hearted = userId
    ? (hearts ?? []).some((h: Record<string, unknown>) => h.user_id === userId)
    : false;

  return NextResponse.json({
    heartCount: activity.hearts_count,
    hearted,
    users,
  });
}
