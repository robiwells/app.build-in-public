"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteCommentButtonProps = {
  commentId: string;
  apiPath?: string;
};

export function DeleteCommentButton({ commentId, apiPath }: DeleteCommentButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(apiPath ?? `/api/comments/${commentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-[#a8a29e] transition-colors hover:text-red-500 disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
