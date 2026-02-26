"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CommentFormProps = {
  postId: string;
  apiPath?: string;
};

export function CommentForm({ postId, apiPath }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      setError("Comment must be 1000 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(apiPath ?? `/api/activities/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data?.error ?? "Failed to post comment.");
      }
    } catch {
      setError("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment…"
        maxLength={1000}
        rows={3}
        className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-[#b5522a]/30"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[#a8a29e]">{body.length}/1000</span>
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="rounded-lg bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:bg-[#9a4522] disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
