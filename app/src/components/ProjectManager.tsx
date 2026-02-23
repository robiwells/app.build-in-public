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
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading projects…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Projects
        </h2>
        <ProjectForm onCreated={load} />
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
              projectHref={username ? `/u/${username}/projects/${p.id}` : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
