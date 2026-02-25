"use client";

import { useCallback, useEffect, useState } from "react";
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

export function ProjectManager({ username }: { username?: string } = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <p className="text-sm text-[#78716c]">
        Loading projects…
      </p>
    );
  }

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
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              editable={true}
              onUpdated={load}
              projectHref={username ? `/u/${username}/projects/${p.slug?.trim() ? p.slug : p.id}` : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
