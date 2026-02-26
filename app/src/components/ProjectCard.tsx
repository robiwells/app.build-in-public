"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { ConnectorModal } from "@/components/ConnectorModal";

type Repo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
  connector_type?: string;
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

export function ProjectCard({
  project,
  editable,
  onUpdated,
  projectHref,
  startInEditMode = false,
}: {
  project: Project;
  editable: boolean;
  onUpdated?: () => void;
  projectHref?: string;
  /** When true, show the edit form immediately (e.g. when opened in a modal). */
  startInEditMode?: boolean;
}) {
  const [editing, setEditing] = useState(startInEditMode);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [url, setUrl] = useState(project.url ?? "");
  const [category, setCategory] = useState(project.category ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilterType, setModalFilterType] = useState<string | undefined>(undefined);

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

  function openModal(filterType?: string) {
    setModalFilterType(filterType);
    setModalOpen(true);
  }

  if (editing) {
    return (
      <>
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

            {/* Connectors section */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-[#2a1f14]">Connectors</label>
                <button
                  type="button"
                  onClick={() => openModal()}
                  className="rounded-full border border-[#e8ddd0] px-2 py-0.5 text-xs text-[#78716c] hover:border-[#c9b99a] hover:text-[#2a1f14]"
                >
                  +
                </button>
              </div>
              {project.project_repos.length === 0 ? (
                <p className="text-xs text-[#a8a29e]">No connectors yet</p>
              ) : (
                <div className="space-y-1">
                  {project.project_repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center gap-2 rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm"
                    >
                      <SourceBadge type={repo.connector_type} />
                      <a
                        href={repo.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-[#78716c] hover:underline"
                      >
                        {repo.repo_full_name}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveRepo(repo.id)}
                        className="shrink-0 text-xs text-[#a8a29e] hover:text-red-500"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(repo.connector_type)}
                        className="shrink-0 text-xs text-[#a8a29e] hover:text-[#2a1f14]"
                        aria-label="Add another"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
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

        {modalOpen && (
          <ConnectorModal
            projectId={project.id}
            filterType={modalFilterType}
            onAdded={() => {
              setModalOpen(false);
              onUpdated?.();
            }}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
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

      {/* Connectors (view mode) */}
      {project.project_repos.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-[#a8a29e] uppercase tracking-wide">
            Connectors
          </p>
          <div className="space-y-1">
            {project.project_repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center gap-2 rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm"
              >
                <SourceBadge type={repo.connector_type} />
                <a
                  href={repo.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[#78716c] hover:underline"
                >
                  {repo.repo_full_name}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SourceBadge({ type }: { type?: string }) {
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
