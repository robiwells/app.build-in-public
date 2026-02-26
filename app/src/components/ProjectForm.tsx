"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { ProjectCard } from "@/components/ProjectCard";
import {
  ConnectorModal,
  type AvailableRepo,
  type PendingConnectorSelection,
} from "@/components/ConnectorModal";

type CreatedProject = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  slug: string | null;
  category: string | null;
  xp: number;
  level: number;
  project_repos: Array<{
    id: string;
    repo_full_name: string;
    repo_url: string;
    connector_type?: string;
  }>;
};

export function ProjectForm({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] = useState<CreatedProject | null>(null);

  // Pending connectors (same UX as edit: "+" opens modal, list with remove)
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);
  const [pendingRepos, setPendingRepos] = useState<AvailableRepo[]>([]);
  const [pendingMedium, setPendingMedium] = useState<{ external_id: string } | null>(null);

  function handleConnectorAdded(selection?: PendingConnectorSelection) {
    if (!selection) return;
    if (selection.repos?.length) {
      setPendingRepos((prev) => {
        const byName = new Map(prev.map((r) => [r.full_name, r]));
        for (const r of selection.repos!) byName.set(r.full_name, r);
        return [...byName.values()];
      });
    }
    if (selection.medium) setPendingMedium(selection.medium);
    setConnectorModalOpen(false);
  }

  function removePendingRepo(fullName: string) {
    setPendingRepos((p) => p.filter((r) => r.full_name !== fullName));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const repos =
        pendingRepos.length > 0
          ? pendingRepos.map((r) => ({
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
          category: category || undefined,
          repos,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to create project");
        return;
      }
      const { projectId } = (await res.json()) as { projectId: string };

      if (pendingMedium) {
        await fetch(`/api/projects/${projectId}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connector_type: "medium",
            external_id: pendingMedium.external_id,
          }),
        });
      }

      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (projectRes.ok) {
        const data = (await projectRes.json()) as { project: CreatedProject };
        setCreatedProject(data.project);
      } else {
        setTitle("");
        setDescription("");
        setUrl("");
        setCategory("");
        setPendingRepos([]);
        setPendingMedium(null);
        setOpen(false);
        onCreated?.();
      }
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  function handleCardDone() {
    setCreatedProject(null);
    setTitle("");
    setDescription("");
    setUrl("");
    setCategory("");
    setPendingRepos([]);
    setPendingMedium(null);
    setOpen(false);
    onCreated?.();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522]"
      >
        New Project
      </button>
    );
  }

  // After creation, show the ProjectCard in edit mode so the user can add connectors immediately
  if (createdProject) {
    return (
      <ProjectCard
        project={createdProject}
        editable={true}
        startInEditMode={true}
        onUpdated={handleCardDone}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card rounded-xl p-4">
      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title *"
          className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm text-[#2a1f14]"
          required
          autoFocus
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

        {/* Connectors (same as edit: "+" opens modal, list with remove) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-[#2a1f14]">Connectors</label>
            <button
              type="button"
              onClick={() => setConnectorModalOpen(true)}
              className="rounded-full border border-[#e8ddd0] px-2 py-0.5 text-xs text-[#78716c] hover:border-[#c9b99a] hover:text-[#2a1f14]"
            >
              +
            </button>
          </div>
          {pendingRepos.length === 0 && !pendingMedium ? (
            <p className="text-xs text-[#a8a29e]">No connectors yet</p>
          ) : (
            <div className="space-y-1">
              {pendingRepos.map((r) => (
                <div
                  key={r.full_name}
                  className="flex items-center gap-2 rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm"
                >
                  <SourceBadge type="github" />
                  <a
                    href={r.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-[#78716c] hover:underline"
                  >
                    {r.full_name}
                  </a>
                  <button
                    type="button"
                    onClick={() => removePendingRepo(r.full_name)}
                    className="shrink-0 text-xs text-[#a8a29e] hover:text-red-500"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              {pendingMedium && (
                <div className="flex items-center gap-2 rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm">
                  <SourceBadge type="medium" />
                  <span className="min-w-0 flex-1 truncate text-[#78716c]">
                    {pendingMedium.external_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingMedium(null)}
                    className="shrink-0 text-xs text-[#a8a29e] hover:text-red-500"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-full bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
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
              setCategory("");
              setPendingRepos([]);
              setPendingMedium(null);
              setError("");
            }}
            className="rounded-full px-4 py-1.5 text-sm text-[#78716c] hover:text-[#2a1f14]"
          >
            Cancel
          </button>
        </div>
      </div>

      {connectorModalOpen && (
        <ConnectorModal
          onAdded={handleConnectorAdded}
          onClose={() => setConnectorModalOpen(false)}
        />
      )}
    </form>
  );
}

function SourceBadge({ type }: { type: string }) {
  if (type === "github") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#24292e] text-[9px] font-bold text-white">
        GH
      </span>
    );
  }
  if (type === "medium") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
        M
      </span>
    );
  }
  return null;
}
