"use client";

import { useState } from "react";

type Props = {
  commentsCount: number;
  initialTab?: "activity" | "discussion";
  activityContent: React.ReactNode;
  discussionContent: React.ReactNode;
};

export function ProjectTabs({
  commentsCount,
  initialTab = "activity",
  activityContent,
  discussionContent,
}: Props) {
  const [tab, setTab] = useState<"activity" | "discussion">(initialTab);

  return (
    <>
      <nav className="mt-6 flex gap-4 border-b border-[#e8ddd0] pb-2 text-sm">
        <button
          onClick={() => setTab("activity")}
          className={
            tab === "activity"
              ? "font-medium text-[#2a1f14]"
              : "text-[#78716c] hover:text-[#b5522a]"
          }
        >
          Activity
        </button>
        <button
          onClick={() => setTab("discussion")}
          className={
            tab === "discussion"
              ? "font-medium text-[#2a1f14]"
              : "text-[#78716c] hover:text-[#b5522a]"
          }
        >
          Discussion ({commentsCount})
        </button>
      </nav>

      <div className={tab === "activity" ? "block" : "hidden"}>{activityContent}</div>
      <div className={tab === "discussion" ? "block" : "hidden"}>{discussionContent}</div>
    </>
  );
}
