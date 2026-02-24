import { createSupabaseAdmin } from "@/lib/supabase";

export function getLocalToday(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysAgo(lastActiveDayLocal: string | null, localToday: string): number {
  if (!lastActiveDayLocal) return Infinity;
  const last = new Date(lastActiveDayLocal + "T00:00:00Z");
  const today = new Date(localToday + "T00:00:00Z");
  return Math.round((today.getTime() - last.getTime()) / 86400000);
}

export function computeStreakStatus(
  lastActiveDayLocal: string | null,
  timezone: string,
  frozen: boolean
): "Safe" | "At Risk" | "Frozen" | "New" {
  if (frozen) return "Frozen";
  if (!lastActiveDayLocal) return "New";
  const localToday = getLocalToday(timezone);
  const gap = daysAgo(lastActiveDayLocal, localToday);
  if (gap <= 1) return "Safe";
  return "At Risk";
}

export function isResetImminent(
  lastActiveDayLocal: string | null,
  timezone: string
): boolean {
  if (!lastActiveDayLocal) return false;
  const localToday = getLocalToday(timezone);
  return daysAgo(lastActiveDayLocal, localToday) >= 2;
}

export async function computeStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActiveDayLocal: string | null;
}> {
  const supabase = createSupabaseAdmin();

  const { data: rows } = await supabase
    .from("activities")
    .select("date_local")
    .eq("user_id", userId)
    .not("date_local", "is", null)
    .order("date_local", { ascending: true });

  if (!rows || rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDayLocal: null };
  }

  // Deduplicate dates
  const dates = [...new Set(rows.map((r) => r.date_local as string))].sort();

  let currentStreak = 1;
  let longestStreak = 1;
  let runStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z");
    const curr = new Date(dates[i] + "T00:00:00Z");
    const gap = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (gap === 1) {
      runStreak++;
      if (runStreak > longestStreak) longestStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }

  // currentStreak = the run ending on the last active day
  currentStreak = runStreak;
  const lastActiveDayLocal = dates[dates.length - 1];

  return { currentStreak, longestStreak, lastActiveDayLocal };
}

export async function incrementStreakAtomic(
  userId: string,
  dateLocal: string
): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.rpc("increment_streak", {
    p_user_id: userId,
    p_date_local: dateLocal,
  });
}
