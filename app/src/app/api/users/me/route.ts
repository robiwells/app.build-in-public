import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== "string") {
      return NextResponse.json({ error: "timezone must be a string" }, { status: 400 });
    }
    // Validate against IANA timezone list
    let validTimezones: readonly string[];
    try {
      validTimezones = Intl.supportedValuesOf("timeZone");
    } catch {
      validTimezones = [];
    }
    if (validTimezones.length > 0 && !validTimezones.includes(body.timezone)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
    updates.timezone = body.timezone;
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", sessionUser.userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
