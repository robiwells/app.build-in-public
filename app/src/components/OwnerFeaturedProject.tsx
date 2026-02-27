"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { levelProgressPct } from "@/lib/xp";

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

interface Props {
  project: Project;
  username: string;
  postCount: number;
  lastActive: string | null;
}

export function OwnerFeaturedProject({ project, username, postCount, lastActive }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [unpinning, setUnpinning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  async function handleUnpin() {
    setUnpinning(true);
    setMenuOpen(false);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_project_id: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to unpin");
        return;
      }
      router.refresh();
    } finally {
      setUnpinning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project? Activity history will be preserved.")) return;
    setMenuOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to delete");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const projectHref = `/u/${username}/projects/${project.slug?.trim() ? project.slug : project.id}`;
  const busy = unpinning || deleting;

  if (editing) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mb-2 text-xs text-[#a8a29e] hover:text-[#78716c]"
        >
          ← Back to featured view
        </button>
        <ProjectCard
          project={project}
          editable={true}
          startInEditMode={true}
          projectHref={projectHref}
          isPinnedProject={true}
          onPinToggle={async (id) => {
            await fetch("/api/user", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pinned_project_id: id }),
            });
            router.refresh();
          }}
          onUpdated={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Level {project.level}
            </span>
            <Link
              href={projectHref}
              className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#2a1f14] hover:text-[#b5522a]"
            >
              {project.title}
            </Link>
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-[#78716c]">{project.description}</p>
          )}
          {project.project_repos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.project_repos.map((repo) => {
                const Wrapper = repo.repo_url ? "a" : "span";
                const wrapperProps = repo.repo_url
                  ? { href: repo.repo_url, target: "_blank", rel: "noopener noreferrer" }
                  : {};
                return (
                  <Wrapper
                    key={repo.id}
                    {...wrapperProps}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs text-[#78716c] shadow-sm hover:text-[#b5522a] hover:underline"
                  >
                    <SourceBadge type={repo.connector_type} />
                    {repo.repo_full_name}
                  </Wrapper>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-[#a8a29e]">
            {postCount} {postCount === 1 ? "post" : "posts"}
            {lastActive && <> · last active {lastActive}</>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-[#a8a29e] hover:bg-amber-100 hover:text-[#b5522a]"
              aria-label="Open project website"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              className="rounded-lg p-1.5 text-[#a8a29e] hover:bg-amber-100 hover:text-[#78716c] disabled:opacity-50"
              aria-label="Featured project options"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-lg border border-[#e8ddd0] bg-white py-1 shadow-lg"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setEditing(true); }}
                  className="w-full px-3 py-2 text-left text-sm text-[#2a1f14] hover:bg-[#f5f0e8]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleUnpin}
                  disabled={busy}
                  className="w-full px-3 py-2 text-left text-sm text-[#2a1f14] hover:bg-[#f5f0e8] disabled:opacity-50"
                >
                  {unpinning ? "Unpinning…" : "Unpin featured"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDelete}
                  disabled={busy}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-full bg-amber-100" style={{ height: "4px" }}>
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ width: `${levelProgressPct(project.xp, project.level)}%` }}
        />
      </div>
    </div>
  );
}

function SourceBadge({ type }: { type?: string }) {
  if (type === "github") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#24292e] text-[7px] font-bold text-white">
        GH
      </span>
    );
  }
  if (type === "medium") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-black text-[7px] font-bold text-white">
        M
      </span>
    );
  }
  return null;
}
