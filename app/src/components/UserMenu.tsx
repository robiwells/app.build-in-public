"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  username: string;
  avatarUrl: string | null | undefined;
  profileHref: string;
}

export function UserMenu({ username, avatarUrl, profileHref }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-transparent hover:ring-zinc-300 focus:outline-none focus:ring-zinc-400 dark:hover:ring-zinc-600 dark:focus:ring-zinc-500"
        aria-label="Open user menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
            {username[0].toUpperCase()}
          </span>
        )}
      </button>

      <div
        className={[
          "absolute right-0 top-full z-50 mt-2 w-48 origin-top-right rounded-xl border border-zinc-200 bg-white shadow-xl transition-all duration-150 dark:border-zinc-800 dark:bg-zinc-900",
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        <div className="py-1">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
