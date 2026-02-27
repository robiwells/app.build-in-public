"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PostMenuProps {
  postId: string;
  /** If set, navigate here after delete (e.g. post detail page). Otherwise router.refresh(). */
  redirectHref?: string;
  /** Show the Pin/Unpin option when true (only for post owner). */
  canPin?: boolean;
  /** Whether this post is currently pinned. */
  isPinned?: boolean;
}

export function PostMenu({ postId, redirectHref, canPin, isPinned }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  async function handleDelete() {
    if (deleting) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete");
        return;
      }
      setOpen(false);
      if (redirectHref) {
        router.push(redirectHref);
      } else {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handlePinToggle() {
    if (pinning) return;
    setPinning(true);
    setOpen(false);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_activity_id: isPinned ? null : postId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to update pin");
        return;
      }
      router.refresh();
    } finally {
      setPinning(false);
    }
  }

  const busy = deleting || pinning;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="rounded p-1 text-[#a8a29e] hover:bg-[#f5f0e8] hover:text-[#78716c] focus:outline-none focus:ring-2 focus:ring-[#b5522a]/30 disabled:opacity-50"
        aria-label="Post options"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center text-lg leading-none">⋯</span>
      </button>
      <div
        className={[
          "absolute right-0 top-full z-50 mt-1 w-44 origin-top-right rounded-lg border border-[#e8ddd0] bg-white py-1 shadow-lg",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        {canPin && (
          <button
            type="button"
            onClick={handlePinToggle}
            disabled={busy}
            className="block w-full px-4 py-2 text-left text-sm text-[#2a1f14] hover:bg-[#f5f0e8] disabled:opacity-50"
          >
            {pinning ? "Updating…" : isPinned ? "Unpin post" : "Pin post"}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
