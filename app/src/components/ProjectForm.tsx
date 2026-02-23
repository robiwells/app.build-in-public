"use client";

import { useEffect, useState } from "react";

type AvailableRepo = { full_name: string; html_url: string; installation_id: number };

export function ProjectForm({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setReposLoading(true);
    fetch("/api/repos/available")
      .then((r) => (r.ok ? r.json() : { repos: [] }))
      .then((data: { repos?: AvailableRepo[] }) => setAvailableRepos(data.repos ?? []))
      .catch(() => setAvailableRepos([]))
      .finally(() => setReposLoading(false));
  }, [open]);

  function toggleRepo(fullName: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const reposPayload =
        selectedRepos.size > 0
          ? availableRepos
              .filter((r) => selectedRepos.has(r.full_name))
              .map((r) => ({
                repo_full_name: r.full_name,
                repo_url: r.html_url,
                installation_id: r.installation_id,
              }))
          : undefined;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          ...(reposPayload?.length ? { repos: reposPayload } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to create project");
        return;
      }
      setTitle("");
      setDescription("");
      setUrl("");
      setSelectedRepos(new Set());
      setOpen(false);
      onCreated?.();
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        New Project
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title *"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          required
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          rows={2}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Project URL (optional)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {/* Repo multi-select */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Connect repositories (optional)
          </label>
          <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
            Select repos to track under this project. Only repos from your GitHub App installation that aren’t already linked appear here.
          </p>
          {reposLoading ? (
            <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Loading repos…
            </p>
          ) : availableRepos.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No repos available. Connect a repo first via Settings → GitHub.
            </p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {availableRepos.map((r) => (
                <label
                  key={r.full_name}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    selectedRepos.has(r.full_name)
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={selectedRepos.has(r.full_name)}
                    onChange={() => toggleRepo(r.full_name)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                  <span className="truncate">{r.full_name}</span>
                </label>
              ))}
            </div>
          )}
          {selectedRepos.size > 0 && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {selectedRepos.size} repo{selectedRepos.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Creating…" : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTitle("");
              setDescription("");
              setUrl("");
              setSelectedRepos(new Set());
              setError("");
            }}
            className="rounded-full px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
