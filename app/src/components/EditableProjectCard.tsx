"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartButton } from "@/components/HeartButton";
import { ProjectCard } from "@/components/ProjectCard";

type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  slug: string | null;
  category: string | null;
  level: number;
  hearts_count: number;
  comments_count: number;
  postCount: number;
  lastActivityDate: string | null;
};

export function EditableProjectCard({
  projectId,
  ownerUsername,
  project,
  sessionUserId,
  initialHearted,
}: {
  projectId: string;
  ownerUsername: string | null;
  project: ProjectSummary;
  sessionUserId: string | null;
  initialHearted: boolean;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fullProject, setFullProject] = useState<{
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
      installation_id?: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const projectHref = ownerUsername
    ? `/u/${ownerUsername}/projects/${project.slug ?? projectId}`
    : null;

  async function openEdit() {
    setShowEditModal(true);
    setLoading(true);
    setFullProject(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { project: typeof fullProject extends infer T ? T : never };
      setFullProject(data.project);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdated() {
    setShowEditModal(false);
    router.refresh();
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleDelete() {
    if (!confirm("Delete this project? Activity history will be preserved.")) return;
    setMenuOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="card rounded-xl p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(120,80,40,0.14)]">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {projectHref ? (
              <Link
                href={projectHref}
                className="font-semibold text-[#2a1f14] hover:text-[#b5522a]"
              >
                {project.title}
              </Link>
            ) : (
              <span className="font-semibold text-[#2a1f14]">{project.title}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Level {project.level ?? 1}
            </span>
            {project.category && (
              <span className="rounded-full bg-[#f5f0e8] px-2 py-0.5 text-xs font-medium text-[#78716c]">
                {project.category}
              </span>
            )}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                disabled={deleting}
                className="rounded-lg p-1.5 text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14] disabled:opacity-50"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="Project options"
              >
                <span className="sr-only">Options</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-10 mt-1 min-w-[8rem] rounded-lg border border-[#e8ddd0] bg-white py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      openEdit();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#2a1f14] hover:bg-[#f5f0e8]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {project.description && (
          <p className="mb-2 line-clamp-2 text-sm text-[#78716c]">
            {project.description}
          </p>
        )}

        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            {ownerUsername && (
              <Link
                href={`/u/${ownerUsername}`}
                className="text-xs text-[#78716c] hover:text-[#b5522a]"
              >
                @{ownerUsername}
              </Link>
            )}
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[55%] truncate text-xs text-[#b5522a] hover:underline"
              >
                {project.url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#a8a29e]">
            <span>
              {project.postCount === 1 ? "1 post" : `${project.postCount} posts`}
            </span>
            {project.lastActivityDate && (
              <>
                <span>·</span>
                <span>
                  updated{" "}
                  {new Date(project.lastActivityDate).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-[#a8a29e]">
            <HeartButton
              postId={projectId}
              apiPath={`/api/projects/${projectId}/hearts`}
              initialCount={project.hearts_count ?? 0}
              initialHearted={initialHearted}
              currentUserId={sessionUserId}
            />
            {projectHref && (
              <Link
                href={`${projectHref}?tab=discussion`}
                className="hover:text-[#b5522a]"
              >
                {project.comments_count ?? 0}{" "}
                {(project.comments_count ?? 0) !== 1 ? "comments" : "comment"}
              </Link>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit project"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[#2a1f14]">Edit project</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-[#78716c]">Loading…</p>
            ) : fullProject ? (
              <ProjectCard
                project={{
                  ...fullProject,
                  xp: fullProject.xp ?? 0,
                  project_repos: fullProject.project_repos,
                }}
                editable={true}
                onUpdated={handleUpdated}
                projectHref={projectHref ?? undefined}
                startInEditMode={true}
              />
            ) : (
              <p className="text-sm text-red-600">Could not load project.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
