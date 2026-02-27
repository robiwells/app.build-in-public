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
      <p className="mt-2 text-base text-[#78716c] leading-relaxed">{bio}</p>
    );
  }

  if (editing) {
    return (
      <div className="mt-3 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a short bio…"
          rows={3}
          className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          autoFocus
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

  if (bio) {
    return (
      <div className="group mt-2 flex items-start gap-2">
        <p className="text-base text-[#78716c] leading-relaxed">{bio}</p>
        <button
          onClick={() => setEditing(true)}
          className="mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-xs text-[#a8a29e] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#f5f0e8] hover:text-[#2a1f14]"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#a8a29e] hover:bg-[#f5f0e8] hover:text-[#78716c] border border-dashed border-[#e8ddd0]"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Add bio
    </button>
  );
}
