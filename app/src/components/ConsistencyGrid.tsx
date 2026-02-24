"use client";

type ConsistencyGridProps = {
  activeDays: string[]; // YYYY-MM-DD strings (user's date_local)
  timezone?: string; // User's timezone so grid uses same "local day" as streak data
};

function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildGrid(activeDays: string[], timezone: string = "UTC"): { date: string; active: boolean }[] {
  const activeSet = new Set(activeDays);
  const cells: { date: string; active: boolean }[] = [];
  const now = new Date();

  // Build last 365 days in the user's local calendar so keys match date_local
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = formatLocalDate(d, timezone);
    cells.push({ date: key, active: activeSet.has(key) });
  }

  return cells;
}

export function ConsistencyGrid({ activeDays, timezone = "UTC" }: ConsistencyGridProps) {
  const cells = buildGrid(activeDays, timezone);

  // Group into weeks (columns of 7)
  const weeks: { date: string; active: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={cell.date}
                className={[
                  "h-3 w-3 rounded-sm",
                  cell.active
                    ? "bg-green-500 dark:bg-green-400"
                    : "bg-zinc-200 dark:bg-zinc-700",
                ].join(" ")}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        {activeDays.length} active day{activeDays.length !== 1 ? "s" : ""} in the last 365 days
      </p>
    </div>
  );
}
