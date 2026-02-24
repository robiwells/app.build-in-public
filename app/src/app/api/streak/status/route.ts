import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { computeStreakStatus, isResetImminent } from "@/lib/streak";
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username");
  const includeDays = searchParams.get("days");

  const supabase = createSupabaseAdmin();

  let userId: string | null = null;

  if (usernameParam) {
    const pattern = usernameParam
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
    const { data: userRow } = await supabase
      .from("users")
      .select("id, timezone, streak_frozen, streak_metadata")
      .ilike("username", pattern)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const meta = parseMetadata(userRow.streak_metadata);
    const status = computeStreakStatus(
      meta.lastActiveDayLocal ?? null,
      userRow.timezone,
      userRow.streak_frozen
    );
    const resetImminent = isResetImminent(meta.lastActiveDayLocal ?? null, userRow.timezone);
    userId = userRow.id;

    const response: Record<string, unknown> = {
      currentStreak: meta.currentStreak ?? 0,
      longestStreak: meta.longestStreak ?? 0,
      lastActiveDayLocal: meta.lastActiveDayLocal ?? null,
      status,
      resetImminent,
    };

    if (includeDays) {
      const { data: days } = await supabase
        .from("activities")
        .select("date_local")
        .eq("user_id", userId)
        .not("date_local", "is", null)
        .order("date_local", { ascending: false });
      response.activeDays = [...new Set((days ?? []).map((r) => r.date_local as string))];
    }

    return NextResponse.json(response);
  }

  // Authenticated user
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  if (!sessionUser?.userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  userId = sessionUser.userId;

  const { data: userRow } = await supabase
    .from("users")
    .select("timezone, streak_frozen, streak_metadata")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const meta = parseMetadata(userRow.streak_metadata);
  const status = computeStreakStatus(
    meta.lastActiveDayLocal ?? null,
    userRow.timezone,
    userRow.streak_frozen
  );
  const resetImminent = isResetImminent(meta.lastActiveDayLocal ?? null, userRow.timezone);

  const response: Record<string, unknown> = {
    currentStreak: meta.currentStreak ?? 0,
    longestStreak: meta.longestStreak ?? 0,
    lastActiveDayLocal: meta.lastActiveDayLocal ?? null,
    status,
    resetImminent,
  };

  if (includeDays) {
    const { data: days } = await supabase
      .from("activities")
      .select("date_local")
      .eq("user_id", userId)
      .not("date_local", "is", null)
      .order("date_local", { ascending: false });
    response.activeDays = [...new Set((days ?? []).map((r) => r.date_local as string))];
  }

  return NextResponse.json(response);
}
