"use client";

import { useState } from "react";

const VISIBLE_INITIAL = 3;

interface ExpandableCommitListProps {
  messages: string[];
  className?: string;
}

export function ExpandableCommitList({ messages, className = "" }: ExpandableCommitListProps) {
  const [expanded, setExpanded] = useState(false);
  if (messages.length === 0) return null;
  const visible = expanded ? messages.length : Math.min(VISIBLE_INITIAL, messages.length);
  const hasMore = messages.length > VISIBLE_INITIAL;
  const hiddenCount = messages.length - VISIBLE_INITIAL;

  return (
    <ul className={`space-y-0.5 text-sm text-[#78716c] ${className}`}>
      {messages.slice(0, visible).map((msg, i) => (
        <li key={i} className="truncate">· {msg}</li>
      ))}
      {hasMore && !expanded && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[#a8a29e] hover:text-[#78716c] hover:underline"
          >
            + {hiddenCount} more
          </button>
        </li>
      )}
      {hasMore && expanded && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[#a8a29e] hover:text-[#78716c] hover:underline"
          >
            Show less
          </button>
        </li>
      )}
    </ul>
  );
}
