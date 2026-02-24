"use client";

import { useState } from "react";

type FreezeControlProps = {
  frozen: boolean;
  resetImminent: boolean;
};

export function FreezeControl({ frozen, resetImminent }: FreezeControlProps) {
  const [isFrozen, setIsFrozen] = useState(frozen);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFreeze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/streak/freeze", { method: "POST" });
      if (res.ok) setIsFrozen(true);
      else setError("Failed to freeze streak");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfreeze(confirmReset = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/streak/unfreeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_reset: confirmReset }),
      });
      if (res.ok) {
        setIsFrozen(false);
        setShowConfirm(false);
      } else {
        const data = await res.json().catch(() => ({}));
        if ((data as { error?: string }).error === "reset_imminent") {
          setShowConfirm(true);
        } else {
          setError("Failed to unfreeze streak");
        }
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Unfreezing now will reset your streak to 0. Post first to save it!
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400"
          >
            Cancel
          </button>
          <button
            onClick={() => handleUnfreeze(true)}
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "…" : "Unfreeze anyway"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isFrozen ? (
        <>
          <span className="text-sm text-blue-600 dark:text-blue-400">
            ❄️ Streak is frozen
          </span>
          <button
            onClick={() => handleUnfreeze(false)}
            disabled={loading}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            {loading ? "…" : "Unfreeze"}
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Protect your streak from a missed day
          </span>
          <button
            onClick={handleFreeze}
            disabled={loading}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            {loading ? "…" : "Freeze streak"}
          </button>
        </>
      )}
      {resetImminent && !isFrozen && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ At risk of reset — post today!
        </span>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
