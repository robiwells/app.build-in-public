"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectForm } from "@/components/ProjectForm";

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

export function ProjectManager({
  username,
  initialPinnedProjectId,
}: {
  username?: string;
  initialPinnedProjectId?: string | null;
} = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinnedProjectId, setPinnedProjectId] = useState<string | null>(
    initialPinnedProjectId ?? null
  );
  const router = useRouter();

  // Sync local state when the server re-renders with updated initialPinnedProjectId
  useEffect(() => {
    setPinnedProjectId(initialPinnedProjectId ?? null);
  }, [initialPinnedProjectId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = (await res.json()) as { projects: Project[] };
      setProjects(data.projects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePinToggle(projectId: string | null) {
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_project_id: projectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to update pin");
        return;
      }
      setPinnedProjectId(projectId);
      router.refresh();
    } catch {
      alert("Request failed");
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[#78716c]">
        Loading projects…
      </p>
    );
  }

  const otherProjects = projects.filter((p) => p.id !== pinnedProjectId);

  const projectHref = (p: Project) =>
    username ? `/u/${username}/projects/${p.slug?.trim() ? p.slug : p.id}` : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#2a1f14]">
          Projects
        </h2>
        <ProjectForm onCreated={load} />
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-[#78716c]">
          No projects yet. Create one to start tracking your work.
        </p>
      ) : otherProjects.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {otherProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              editable={true}
              onUpdated={load}
              projectHref={projectHref(p)}
              isPinnedProject={false}
              onPinToggle={handlePinToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
