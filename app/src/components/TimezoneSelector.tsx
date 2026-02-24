"use client";

import { useEffect, useMemo, useState } from "react";

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
  // Defer the full option list to the client to avoid hydration mismatches.
  // Node.js and browsers ship different ICU timezone databases, so any server-side
  // offset computation can produce a different sort order than the client's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tzOptions = useMemo(() => {
    if (!mounted) {
      // During SSR and the initial hydration pass: render only the stored value so
      // both environments produce identical HTML and React finds no mismatch.
      return [{ value: currentTimezone, label: currentTimezone, offsetMin: 0 }];
    }

    let names: string[] = [];
    try {
      names = Intl.supportedValuesOf("timeZone") as string[];
    } catch {
      names = [];
    }
    // Always include the currently-stored value (fixes UTC missing from some runtimes)
    if (!names.includes(currentTimezone)) {
      names = [currentTimezone, ...names];
    }

    const REF = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    return names
      .map((tz) => {
        let offsetMin = 0;
        try {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "shortOffset",
          }).formatToParts(REF);
          const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
          const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
          if (match) {
            offsetMin =
              (match[1] === "+" ? 1 : -1) *
              (parseInt(match[2]) * 60 + parseInt(match[3] ?? "0"));
          }
        } catch {
          offsetMin = 0;
        }

        const sign = offsetMin >= 0 ? "+" : "-";
        const abs = Math.abs(offsetMin);
        const h = String(Math.floor(abs / 60)).padStart(2, "0");
        const m = String(abs % 60).padStart(2, "0");
        const label = `(UTC${sign}${h}:${m}) ${tz}`;

        return { value: tz, label, offsetMin };
      })
      .sort((a, b) => a.offsetMin - b.offsetMin || a.value.localeCompare(b.value));
  }, [mounted, currentTimezone]);

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
        className="w-full max-w-sm rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
      >
        {tzOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {localTime && (
        <p className="text-sm text-[#78716c]">
          Current local time: <span className="font-medium">{localTime}</span>
        </p>
      )}
      {saving && <p className="text-sm text-[#78716c]">Saving…</p>}
      {saved && <p className="text-sm text-green-600">Saved</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
