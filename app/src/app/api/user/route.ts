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

  let body: { bio?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bio = typeof body.bio === "string" ? body.bio.trim() || null : null;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("users")
    .update({ bio })
    .eq("id", user.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
