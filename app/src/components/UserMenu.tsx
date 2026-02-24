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
        className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-transparent hover:ring-[#c9b99a] focus:outline-none focus:ring-[#b5522a]"
        aria-label="Open user menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#f5f0e8] text-sm font-semibold text-[#78716c]">
            {username[0].toUpperCase()}
          </span>
        )}
      </button>

      <div
        className={[
          "absolute right-0 top-full z-50 mt-2 w-48 origin-top-right rounded-xl border border-[#e8ddd0] bg-white shadow-lg transition-all duration-150",
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        <div className="py-1">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-[#2a1f14] hover:bg-[#f5f0e8]"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-[#2a1f14] hover:bg-[#f5f0e8]"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-[#e8ddd0]" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full px-4 py-2 text-left text-sm text-[#2a1f14] hover:bg-[#f5f0e8]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
