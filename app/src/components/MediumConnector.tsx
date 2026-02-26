"use client";

import { useState } from "react";

export function MediumConnector({
  initialConnected,
  initialDisplayName,
}: {
  initialConnected: boolean;
  initialDisplayName: string | null;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [latestTitle, setLatestTitle] = useState<string | null>(null);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSaving(true);
    setError("");
    setLatestTitle(null);
    try {
      const res = await fetch("/api/connectors/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id: input.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; display_name?: string; latest_title?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to link feed");
        return;
      }
      setConnected(true);
      setDisplayName(data.display_name ?? input.trim());
      setLatestTitle(data.latest_title ?? null);
      setInput("");
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card w-80 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f0e8]">
            {/* Medium "M" icon */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#2a1f14]">
              <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
            </svg>
          </div>
          <span className="font-medium text-[#2a1f14]">Medium</span>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#a8a29e]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9b99a]" />
            Not connected
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-[#78716c]">
        Automatically import your Medium articles into your project feeds.
      </p>
      {connected && displayName && (
        <p className="mt-2 text-sm font-medium text-[#2a1f14]">{displayName}</p>
      )}
      {latestTitle && (
        <p className="mt-1 text-xs text-[#78716c]">Latest post: {latestTitle}</p>
      )}
      <form onSubmit={handleLink} className="mt-4 space-y-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="@username or publication-slug"
          className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14] placeholder:text-[#a8a29e]"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !input.trim()}
          className="rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
        >
          {saving ? "Linking…" : connected ? "Update" : "Link feed"}
        </button>
      </form>
    </div>
  );
}
