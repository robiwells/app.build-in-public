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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          Unfreezing now will reset your streak to 0. Post first to save it!
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-full border border-[#e8ddd0] px-4 py-1.5 text-sm text-[#78716c] hover:border-[#c9b99a]"
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
          <span className="text-sm text-blue-600">
            ❄️ Streak is frozen
          </span>
          <button
            onClick={() => handleUnfreeze(false)}
            disabled={loading}
            className="rounded-full border border-[#e8ddd0] px-4 py-1.5 text-sm text-[#78716c] hover:border-[#c9b99a] disabled:opacity-50"
          >
            {loading ? "…" : "Unfreeze"}
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-[#78716c]">
            Protect your streak from a missed day
          </span>
          <button
            onClick={handleFreeze}
            disabled={loading}
            className="rounded-full border border-[#e8ddd0] px-4 py-1.5 text-sm text-[#78716c] hover:border-[#c9b99a] disabled:opacity-50"
          >
            {loading ? "…" : "Freeze streak"}
          </button>
        </>
      )}
      {resetImminent && !isFrozen && (
        <span className="text-xs text-amber-600">
          ⚠️ At risk of reset — post today!
        </span>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
