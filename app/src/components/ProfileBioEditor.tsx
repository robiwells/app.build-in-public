"use client";

import { useState } from "react";

export function ProfileBioEditor({
  bio: initialBio,
  isOwner,
}: {
  bio: string | null;
  isOwner: boolean;
}) {
  const [bio, setBio] = useState(initialBio);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      setBio(draft.trim() || null);
      setEditing(false);
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(bio ?? "");
    setEditing(false);
    setError("");
  }

  if (!isOwner) {
    if (!bio) return null;
    return (
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{bio}</p>
    );
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a short bio…"
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="rounded-full px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      {bio ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{bio}</p>
      ) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Add a bio…</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        Edit
      </button>
    </div>
  );
}
