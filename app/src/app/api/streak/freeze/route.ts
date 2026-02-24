import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("users")
    .update({ streak_frozen: true, updated_at: new Date().toISOString() })
    .eq("id", sessionUser.userId);

  if (error) {
    return NextResponse.json({ error: "Failed to freeze streak" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
