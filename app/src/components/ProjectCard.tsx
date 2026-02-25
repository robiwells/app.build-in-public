"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { levelProgressPct } from "@/lib/xp";

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
  slug: string | null;
  category: string | null;
  xp: number;
  level: number;
  project_repos: Repo[];
};

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
      <div className="card rounded-xl p-4">
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Project URL (optional)"
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          >
            <option value="">Category (optional)</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/* Repo multi-select when editing */}
          <div>
            <label className="block text-sm font-medium text-[#2a1f14]">
              Repositories
            </label>
            <p className="mb-2 text-xs text-[#a8a29e]">
              Select which repos to track under this project.
            </p>
            {reposLoading ? (
              <p className="rounded-lg border border-[#e8ddd0] p-3 text-sm text-[#78716c]">
                Loading repos…
              </p>
            ) : availableRepos.length === 0 ? (
              <p className="rounded-lg border border-[#e8ddd0] p-3 text-sm text-[#78716c]">
                No repos available. Connect a repo via Settings → GitHub.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[#e8ddd0] p-2">
                {availableRepos.map((r) => (
                  <label
                    key={r.full_name}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      selectedRepos.has(r.full_name)
                        ? "bg-[#f5f0e8] text-[#2a1f14]"
                        : "text-[#78716c] hover:bg-[#faf7f2]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRepos.has(r.full_name)}
                      onChange={() => toggleRepo(r.full_name)}
                      className="h-4 w-4 rounded border-[#e8ddd0] text-[#b5522a] focus:ring-[#b5522a]/30"
                    />
                    <span className="truncate">{r.full_name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedRepos.size > 0 && (
              <p className="mt-1 text-xs text-[#78716c]">
                {selectedRepos.size} repo{selectedRepos.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-full bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
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
              className="rounded-full px-4 py-1.5 text-sm text-[#78716c] hover:text-[#2a1f14]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#2a1f14]">
              {projectHref ? (
                <Link href={projectHref} className="hover:text-[#b5522a]">
                  {project.title}
                </Link>
              ) : (
                project.title
              )}
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Level {project.level}
            </span>
            {project.category && (
              <span className="rounded-full bg-[#f5f0e8] px-2 py-0.5 text-xs font-medium text-[#78716c]">
                {project.category}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-[#78716c]">
              {project.description}
            </p>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-[#b5522a] hover:underline"
            >
              {project.url}
            </a>
          )}
        </div>
        {editable && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-2 py-1 text-xs text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14]"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg px-2 py-1 text-xs text-[#78716c] hover:bg-red-50 hover:text-red-600"
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
              className="flex items-center justify-between rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm"
            >
              <a
                href={repo.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[#78716c] hover:underline"
              >
                {repo.repo_full_name}
              </a>
              {editable && (
                <button
                  onClick={() => handleRemoveRepo(repo.id)}
                  className="ml-2 shrink-0 text-xs text-[#a8a29e] hover:text-red-500"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {project.project_repos.length === 0 && (
        <p className="mt-3 text-sm text-[#a8a29e]">
          No repos tracked yet
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
