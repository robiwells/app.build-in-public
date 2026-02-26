import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_connectors")
    .select("id, type, external_id, display_name")
    .eq("user_id", user.userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/connectors] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ connectors: data ?? [] });
}
