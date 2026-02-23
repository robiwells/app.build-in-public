"use client";

import { useState } from "react";

type Repo = { name: string; full_name: string; html_url: string };

export function RepoPicker({
  repos,
  username,
  setupToken,
}: {
  repos: Repo[];
  username: string;
  setupToken?: string;
}) {
  const [selected, setSelected] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const repo = repos.find((r) => r.full_name === selected);
    if (!repo) return;
    setLoading(true);
    setError("");
    try {
      const url = setupToken ? "/api/github-app/project" : "/api/projects";
      const repoName = repo.full_name.split("/").pop() ?? repo.full_name;
      const title = projectTitle.trim() || repoName;

      const body = setupToken
        ? { token: setupToken, repo_full_name: repo.full_name, repo_url: repo.html_url, title }
        : { repo_full_name: repo.full_name, repo_url: repo.html_url, title };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || res.statusText);
        return;
      }
      if (setupToken) {
        const data = await res.json().catch(() => ({}));
        window.location.href = (data as { redirect?: string }).redirect ?? `/u/${username}`;
      } else {
        window.location.href = `/u/${username}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Choose a repo to track
        </label>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            if (!projectTitle.trim()) {
              const repo = repos.find((r) => r.full_name === e.target.value);
              if (repo) {
                setProjectTitle(repo.full_name.split("/").pop() ?? repo.full_name);
              }
            }
          }}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          required
        >
          <option value="">Select a repository</option>
          {repos.map((r) => (
            <option key={r.full_name} value={r.full_name}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Project name
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. My SaaS App"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Defaults to the repo name if left blank. You can change this later.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Saving…" : "Track this repo"}
      </button>
    </form>
  );
}
