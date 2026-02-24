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
      setError("Select at least one repository to add to a project");
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
      {/* Project selector (optional — user can skip) */}
      <div>
        <label className="block text-sm font-medium text-[#2a1f14]">
          Add repos to a project (optional)
        </label>
        <select
          value={projectChoice}
          onChange={(e) => setProjectChoice(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-[#2a1f14]"
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
          <label className="block text-sm font-medium text-[#2a1f14]">
            Project title
          </label>
          <input
            type="text"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            placeholder="e.g. My SaaS App"
            className="mt-1 w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          />
        </div>
      )}

      {/* Repo multi-select */}
      <div>
        <label className="block text-sm font-medium text-[#2a1f14]">
          Repositories
        </label>
        <p className="mb-2 text-xs text-[#a8a29e]">
          Select the repos to track under this project.
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[#e8ddd0] p-2">
          {repos.map((r) => (
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
        {selectedRepos.size > 0 && (
          <p className="mt-1 text-xs text-[#78716c]">
            {selectedRepos.size} repo{selectedRepos.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading || selectedRepos.size === 0}
          className="rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
        >
          {loading
            ? "Saving…"
            : selectedRepos.size > 0
              ? `Add to project (${selectedRepos.size} repo${selectedRepos.size !== 1 ? "s" : ""})`
              : "Add to project"}
        </button>
        <a
          href={`/u/${username}`}
          className="text-sm text-[#78716c] hover:text-[#b5522a]"
        >
          Skip for now — I&apos;ll add repos to projects later
        </a>
      </div>
    </form>
  );
}
