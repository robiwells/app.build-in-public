"use client";

import { useState } from "react";

type TimezoneSelectorProps = {
  currentTimezone: string;
};

function getLocalTimePreview(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function TimezoneSelector({ currentTimezone }: TimezoneSelectorProps) {
  const [selected, setSelected] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  let timezones: string[] = [];
  try {
    timezones = Intl.supportedValuesOf("timeZone") as string[];
  } catch {
    timezones = [];
  }

  async function handleChange(tz: string) {
    setSelected(tz);
    setSaved(false);
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz }),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to update timezone");
      }
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  const localTime = getLocalTimePreview(selected);

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {localTime && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Current local time: <span className="font-medium">{localTime}</span>
        </p>
      )}
      {saving && <p className="text-sm text-zinc-500 dark:text-zinc-400">Saving…</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Saved</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
