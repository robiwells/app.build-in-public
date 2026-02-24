"use client";

import { useState } from "react";

type HeartButtonProps = {
  postId: string;
  initialCount: number;
  initialHearted: boolean;
  currentUserId: string | null;
};

export function HeartButton({
  postId,
  initialCount,
  initialHearted,
  currentUserId,
}: HeartButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hearted, setHearted] = useState(initialHearted);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!currentUserId) {
      const callbackUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/api/auth/signin?callbackUrl=${callbackUrl}`;
      return;
    }

    if (loading) return;

    // Optimistic update
    setHearted((h) => !h);
    setCount((c) => (hearted ? c - 1 : c + 1));
    setLoading(true);

    try {
      const res = await fetch(`/api/activities/${postId}/hearts`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.heartCount);
        setHearted(data.hearted);
      } else {
        // Revert on error
        setHearted((h) => !h);
        setCount((c) => (hearted ? c + 1 : c - 1));
      }
    } catch {
      // Revert on error
      setHearted((h) => !h);
      setCount((c) => (hearted ? c + 1 : c - 1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label={hearted ? "Unlike" : "Like"}
      className={`flex items-center gap-1 text-sm transition-colors ${
        hearted
          ? "text-rose-500"
          : "text-zinc-400 hover:text-rose-400"
      } disabled:opacity-60`}
    >
      <span aria-hidden="true">{hearted ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
