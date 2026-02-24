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
    <ul className={`space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400 ${className}`}>
      {messages.slice(0, visible).map((msg, i) => (
        <li key={i} className="truncate">· {msg}</li>
      ))}
      {hasMore && !expanded && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-zinc-400 hover:text-zinc-600 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
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
            className="text-zinc-400 hover:text-zinc-600 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Show less
          </button>
        </li>
      )}
    </ul>
  );
}
