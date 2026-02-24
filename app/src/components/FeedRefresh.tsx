"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 45_000; // 45 seconds – new commits/posts show without full reload

/**
 * Periodically refreshes the server-rendered feed so new activities (e.g. GitHub
 * commits from webhooks) appear without the user manually refreshing the page.
 * Only runs when the tab is visible.
 */
export function FeedRefresh() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    }

    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [router]);

  return null;
}
