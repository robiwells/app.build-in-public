"use client";

type ConsistencyGridProps = {
  activeDays: string[]; // YYYY-MM-DD strings
};

function buildGrid(activeDays: string[]): { date: string; active: boolean }[] {
  const activeSet = new Set(activeDays);
  const cells: { date: string; active: boolean }[] = [];

  // Work entirely in UTC to avoid DST-boundary duplicates
  const todayUTC = new Date().toISOString().slice(0, 10);
  const endMs = new Date(todayUTC + "T00:00:00Z").getTime();

  for (let i = 364; i >= 0; i--) {
    const key = new Date(endMs - i * 86400000).toISOString().slice(0, 10);
    cells.push({ date: key, active: activeSet.has(key) });
  }

  return cells;
}

export function ConsistencyGrid({ activeDays }: ConsistencyGridProps) {
  const cells = buildGrid(activeDays);

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
