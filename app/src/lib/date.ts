/** "Today" in the given timezone as YYYY-MM-DD (for activity date_local, heatmap, etc.). */
export function getLocalToday(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
