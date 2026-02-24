import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: comment } = await supabase
    .from("comments")
    .select("id, user_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("comments").delete().eq("id", commentId);

  return NextResponse.json({ ok: true });
}
