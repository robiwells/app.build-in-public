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
      <p className="mt-1 text-sm text-[#78716c]">{bio}</p>
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
          className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="rounded-full px-4 py-1.5 text-sm text-[#78716c] hover:text-[#2a1f14]"
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
        <p className="text-sm text-[#78716c]">{bio}</p>
      ) : (
        <p className="text-sm text-[#a8a29e]">Add a bio…</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg px-2 py-1 text-xs text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14]"
      >
        Edit
      </button>
    </div>
  );
}
