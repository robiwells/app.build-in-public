"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Repo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string | null;
  project_repos: Repo[];
};

const CATEGORIES = ["Coding", "Writing", "Art", "Fitness", "Music", "Other"];

type AvailableRepo = { full_name: string; html_url: string; installation_id: number };

export function ProjectCard({
  project,
  editable,
  onUpdated,
  projectHref,
}: {
  project: Project;
  editable: boolean;
  onUpdated?: () => void;
  projectHref?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [url, setUrl] = useState(project.url ?? "");
  const [category, setCategory] = useState(project.category ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!editing || !editable) return;
    setSelectedRepos(new Set(project.project_repos.map((r) => r.repo_full_name)));
    setReposLoading(true);
    fetch(`/api/repos/available?projectId=${encodeURIComponent(project.id)}`)
      .then((r) => (r.ok ? r.json() : { repos: [] }))
      .then((data: { repos?: AvailableRepo[] }) => setAvailableRepos(data.repos ?? []))
      .catch(() => setAvailableRepos([]))
      .finally(() => setReposLoading(false));
  }, [editing, editable, project.id, project.project_repos]);

  function toggleRepo(fullName: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          url: url.trim() || null,
          category: category || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      const currentFullNames = new Set(project.project_repos.map((r) => r.repo_full_name));
      const toRemove = project.project_repos.filter((r) => !selectedRepos.has(r.repo_full_name));
      const toAdd = availableRepos.filter(
        (r) => selectedRepos.has(r.full_name) && !currentFullNames.has(r.full_name)
      );
      for (const repo of toRemove) {
        await fetch(`/api/projects/${project.id}/repos/${repo.id}`, { method: "DELETE" });
      }
      for (const repo of toAdd) {
        await fetch(`/api/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_full_name: repo.full_name,
            repo_url: repo.html_url,
            installation_id: repo.installation_id,
          }),
        });
      }
      setEditing(false);
      onUpdated?.();
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project? Activity history will be preserved.")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to delete");
        return;
      }
      onUpdated?.();
    } catch {
      setError("Request failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveRepo(repoId: string) {
    try {
      const res = await fetch(`/api/projects/${project.id}/repos/${repoId}`, {
        method: "DELETE",
      });
      if (res.ok) onUpdated?.();
    } catch {
      /* swallow */
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            required
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
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Category (optional)</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/* Repo multi-select when editing */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Repositories
            </label>
            <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
              Select which repos to track under this project.
            </p>
            {reposLoading ? (
              <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Loading repos…
              </p>
            ) : availableRepos.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No repos available. Connect a repo via Settings → GitHub.
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
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setTitle(project.title);
                setDescription(project.description ?? "");
                setUrl(project.url ?? "");
                setCategory(project.category ?? "");
              }}
              className="rounded-full px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {projectHref ? (
                <Link href={projectHref} className="hover:underline">
                  {project.title}
                </Link>
              ) : (
                project.title
              )}
            </h3>
            {project.category && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {project.category}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {project.description}
            </p>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {project.url}
            </a>
          )}
        </div>
        {editable && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {project.project_repos.length > 0 && (
        <div className="mt-3 space-y-1">
          {project.project_repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800/50"
            >
              <a
                href={repo.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {repo.repo_full_name}
              </a>
              {editable && (
                <button
                  onClick={() => handleRemoveRepo(repo.id)}
                  className="ml-2 shrink-0 text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {project.project_repos.length === 0 && (
        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
          No repos tracked yet
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
