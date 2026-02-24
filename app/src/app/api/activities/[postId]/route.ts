import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(
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

  const { data: activity } = await supabase
    .from("activities")
    .select("id, user_id")
    .eq("id", postId)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (activity.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("activities").delete().eq("id", postId);

  return NextResponse.json({ ok: true });
}
