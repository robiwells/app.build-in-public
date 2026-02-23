"use client";

import { useState } from "react";

type Repo = { name: string; full_name: string; html_url: string };
type ExistingProject = { id: string; title: string };

const NEW_PROJECT_VALUE = "__new__";

export function RepoPicker({
  repos,
  username,
  setupToken,
  existingProjects = [],
}: {
  repos: Repo[];
  username: string;
  setupToken?: string;
  existingProjects?: ExistingProject[];
}) {
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [projectChoice, setProjectChoice] = useState(
    existingProjects.length > 0 ? existingProjects[0].id : NEW_PROJECT_VALUE
  );
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isNewProject = projectChoice === NEW_PROJECT_VALUE;

  function toggleRepo(fullName: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRepos.size === 0) {
      setError("Select at least one repository");
      return;
    }
    if (isNewProject && !newProjectTitle.trim()) {
      setError("Project title is required");
      return;
    }

    const selectedRepoObjects = repos.filter((r) => selectedRepos.has(r.full_name));

    setLoading(true);
    setError("");
    try {
      const reposPayload = selectedRepoObjects.map((r) => ({
        repo_full_name: r.full_name,
        repo_url: r.html_url,
      }));

      const body = isNewProject
        ? { token: setupToken, repos: reposPayload, title: newProjectTitle.trim() }
        : { token: setupToken, repos: reposPayload, project_id: projectChoice };

      const res = await fetch("/api/github-app/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || res.statusText);
        return;
      }
      const data = await res.json().catch(() => ({}));
      window.location.href = (data as { redirect?: string }).redirect ?? `/u/${username}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Project selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Add to project
        </label>
        <select
          value={projectChoice}
          onChange={(e) => setProjectChoice(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {existingProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value={NEW_PROJECT_VALUE}>+ Create new project</option>
        </select>
      </div>

      {isNewProject && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Project title
          </label>
          <input
            type="text"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            placeholder="e.g. My SaaS App"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      )}

      {/* Repo multi-select */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Repositories
        </label>
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          Select the repos to track under this project.
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          {repos.map((r) => (
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
        {selectedRepos.size > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {selectedRepos.size} repo{selectedRepos.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || selectedRepos.size === 0}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading
          ? "Saving…"
          : `Track ${selectedRepos.size || ""} repo${selectedRepos.size !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
