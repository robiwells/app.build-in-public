"use client";

import { useState } from "react";

type Cell = { date: string; count: number; isToday: boolean };

type ConsistencyGridProps = {
  activityData: { date: string; count: number }[];
  timezone?: string;
};

function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function intensityColor(count: number): string {
  if (count === 0) return "#e8ddd0";
  if (count === 1) return "#c8b09a";
  if (count <= 3) return "#a07848";
  if (count <= 6) return "#785030";
  return "#4a2c18";
}

/**
 * Builds exactly 53 complete 7-cell columns (Sunday–Saturday).
 *
 * Start: the Sunday on or before (today − 364 days).
 * End:   today, then pad with transparent cells to complete the current week.
 *
 * This ensures every column — including the first — starts on Sunday with a
 * real cell in every row. The M label always sits next to a visible cell.
 */
function buildGrid(
  activityData: { date: string; count: number }[],
  timezone: string,
): { cells: Cell[]; windowStart: string } {
  const countMap = new Map(activityData.map((d) => [d.date, d.count]));
  const now = new Date();
  const today = formatLocalDate(now, timezone);

  // The nominal 365-day window start
  const oldest = new Date(now.getTime() - 364 * 86400000);
  const windowStart = formatLocalDate(oldest, timezone);

  // Day-of-week of oldest (0 = Sun). Go back that many extra days to reach Sunday.
  const oldestDow = new Date(windowStart + "T12:00:00").getDay();
  const totalRealDays = 365 + oldestDow; // days from start-Sunday through today

  const cells: Cell[] = [];

  for (let i = totalRealDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = formatLocalDate(d, timezone);
    cells.push({ date: key, count: countMap.get(key) ?? 0, isToday: key === today });
  }

  // Pad the tail of the current week with transparent future-day cells
  const todayDow = new Date(today + "T12:00:00").getDay();
  const tailPad = (6 - todayDow + 7) % 7; // 0 when today is already Saturday
  for (let i = 0; i < tailPad; i++) {
    cells.push({ date: "", count: -1, isToday: false });
  }

  return { cells, windowStart };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Row 0 = Sunday (unlabelled), 1 = Mon, 3 = Wed, 5 = Fri
const DAY_LABELS = ["", "M", "", "W", "", "F", ""];

function getMonthLabel(week: Cell[]): string {
  for (const cell of week) {
    if (cell.date && cell.date.endsWith("-01")) {
      return MONTHS[parseInt(cell.date.split("-")[1], 10) - 1];
    }
  }
  return "";
}

function cellTitle(cell: Cell): string {
  if (!cell.date) return "";
  const [y, m, d] = cell.date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (cell.count === 0) return label;
  return `${label} · ${cell.count} ${cell.count === 1 ? "activity" : "activities"}`;
}

export function ConsistencyGrid({ activityData, timezone = "UTC" }: ConsistencyGridProps) {
  const { cells: allCells, windowStart } = buildGrid(activityData, timezone);

  const weeks: Cell[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  // Count only within the 365-day window (excludes the 0–6 lead-in days)
  const totalActive = allCells.filter((c) => c.count > 0 && c.date >= windowStart).length;

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col">
        {/*
          Month labels — ml-5 (1.25 rem = 20 px) offsets past the day-label
          column: w-4 (16 px) + mr-1 (4 px) = 20 px, so labels sit directly
          above the cells they annotate.
        */}
        <div className="mb-0.5 ml-[33px] flex gap-px">
          {weeks.map((week, wi) => (
            <div key={wi} className="w-3 text-[10px] leading-none text-[#a8a29e]">
              {getMonthLabel(week)}
            </div>
          ))}
        </div>

        {/*
          Day labels and cells are siblings inside this flex row.
          Their tops align automatically — no spacer, no CSS Grid needed.
        */}
        <div className="flex">
          {/* Day labels column */}
          <div className="mr-1 flex flex-col gap-0.5">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex h-3 w-4 items-center justify-center text-[10px] text-[#a8a29e]"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="flex gap-px">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    className="h-3 w-3 cursor-default rounded-sm"
                    style={{
                      backgroundColor:
                        cell.count < 0 ? "transparent" : intensityColor(cell.count),
                    }}
                    onMouseEnter={(e) => {
                      const text = cellTitle(cell);
                      if (!text) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-between text-xs text-[#a8a29e]">
        <span>
          {totalActive} active day{totalActive !== 1 ? "s" : ""} in the last 365 days
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {["#e8ddd0", "#c8b09a", "#a07848", "#785030", "#4a2c18"].map((c) => (
            <div key={c} className="h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Immediate tooltip — position:fixed is not clipped by overflow-x-auto */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-[#2a1f14] px-2 py-1 text-[10px] text-white"
          style={{ left: tooltip.x, top: tooltip.y - 4 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
