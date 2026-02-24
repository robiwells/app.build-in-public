"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PostMenuProps {
  postId: string;
  /** If set, navigate here after delete (e.g. post detail page). Otherwise router.refresh(). */
  redirectHref?: string;
}

export function PostMenu({ postId, redirectHref }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={deleting}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:focus:ring-zinc-500 disabled:opacity-50"
        aria-label="Post options"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center text-lg leading-none">⋯</span>
      </button>
      <div
        className={[
          "absolute right-0 top-full z-50 mt-1 w-40 origin-top-right rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
