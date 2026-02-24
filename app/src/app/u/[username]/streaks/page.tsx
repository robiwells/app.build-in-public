import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { computeStreakStatus, isResetImminent } from "@/lib/streak";
import { ConsistencyGrid } from "@/components/ConsistencyGrid";
import { FreezeControl } from "./FreezeControl";
import type { Json } from "@/lib/database.types";

export const revalidate = 30;

type StreakMetadata = {
  currentStreak?: number;
  longestStreak?: number;
  lastActiveDayLocal?: string;
};

function parseMetadata(raw: Json | null): StreakMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as StreakMetadata;
}

const STATUS_STYLES: Record<string, string> = {
  Safe: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "At Risk": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Frozen: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  New: "",
};

export default async function StreaksDashboard({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = createSupabaseAdmin();
  const pattern = username
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: user } = await supabase
    .from("users")
    .select("id, username, timezone, streak_frozen, streak_metadata")
    .ilike("username", pattern)
    .maybeSingle();

  if (!user) notFound();

  // Fetch active days for the grid
  const { data: activityRows } = await supabase
    .from("activities")
    .select("date_local")
    .eq("user_id", user.id)
    .not("date_local", "is", null)
    .order("date_local", { ascending: false });

  const activeDays = [...new Set((activityRows ?? []).map((r) => r.date_local as string))];

  const meta = parseMetadata(user.streak_metadata);
  const status = computeStreakStatus(
    meta.lastActiveDayLocal ?? null,
    user.timezone,
    user.streak_frozen
  );
  const resetImminentFlag = isResetImminent(meta.lastActiveDayLocal ?? null, user.timezone);

  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const isOwner = sessionUser?.userId === user.id;

  const currentStreak = meta.currentStreak ?? 0;
  const longestStreak = meta.longestStreak ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Link
        href={`/u/${username}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to profile
      </Link>

      <header className="mt-4 mb-8">
        {status === "New" ? (
          <p className="text-zinc-500 dark:text-zinc-400">No activity yet — make your first post to start a streak!</p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔥</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {currentStreak}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">day streak</span>
                {status !== "Safe" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? ""}`}>
                    {status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Longest: {longestStreak} day{longestStreak !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}
      </header>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          365-day consistency
        </h2>
        <ConsistencyGrid activeDays={activeDays} />
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Streak protection
          </h2>
          <FreezeControl frozen={user.streak_frozen} resetImminent={resetImminentFlag} />
        </section>
      )}
    </main>
  );
}
