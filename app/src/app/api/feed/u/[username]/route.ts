import { createSupabaseAdmin } from "@/lib/supabase";
import { queryUserFeed } from "@/lib/feed";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");

  const supabase = createSupabaseAdmin();

  const pattern = username.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const { data: user } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .ilike("username", pattern)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { feed, nextCursor, dbError } = await queryUserFeed(user.id, { cursor, category, limit });

  if (dbError) {
    console.error("GET /api/feed/u/[username] error:", dbError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    user: { username: user.username, avatar_url: user.avatar_url },
    feed,
    nextCursor,
  });
}
