import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { isResetImminent } from "@/lib/streak";
import type { Json } from "@/lib/database.types";

type StreakMetadata = {
  currentStreak?: number;
  longestStreak?: number;
  lastActiveDayLocal?: string;
};

function parseMetadata(raw: Json | null): StreakMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as StreakMetadata;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = sessionUser.userId;

  let body: { confirm_reset?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const supabase = createSupabaseAdmin();

  const { data: userRow } = await supabase
    .from("users")
    .select("timezone, streak_metadata")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const meta = parseMetadata(userRow.streak_metadata);
  const imminent = isResetImminent(meta.lastActiveDayLocal ?? null, userRow.timezone);

  if (imminent && body.confirm_reset !== true) {
    return NextResponse.json({ error: "reset_imminent" }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    streak_frozen: false,
    updated_at: new Date().toISOString(),
  };

  if (imminent) {
    // Reset current streak to 0 since the user is in a third missed day
    const newMeta = {
      ...meta,
      currentStreak: 0,
    };
    updates.streak_metadata = newMeta;
  }

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to unfreeze streak" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
