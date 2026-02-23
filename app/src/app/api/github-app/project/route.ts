import { auth } from "@/lib/auth";
import { addRepoToProject, createProjectWithRepos } from "@/lib/projects";
import { NextResponse } from "next/server";
import { verifySetupToken } from "@/lib/github-app";

type RepoPayload = { repo_full_name: string; repo_url: string };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: {
    token?: string;
    repos?: RepoPayload[];
    project_id?: string;
    title?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, repos, project_id, title } = body;
  const installationId = verifySetupToken(token ?? null);
  if (installationId === null) {
    return NextResponse.json({ error: "Invalid or expired setup token" }, { status: 400 });
  }
  if (!repos || repos.length === 0) {
    return NextResponse.json({ error: "At least one repo is required" }, { status: 400 });
  }
  for (const r of repos) {
    if (!r.repo_full_name || !r.repo_url) {
      return NextResponse.json(
        { error: "Each repo must have repo_full_name and repo_url" },
        { status: 400 }
      );
    }
  }

  // Add to existing project
  if (project_id) {
    const errors: string[] = [];
    for (const r of repos) {
      const { error } = await addRepoToProject(project_id, user.userId, {
        repoFullName: r.repo_full_name,
        repoUrl: r.repo_url,
        installationId,
      });
      if (error) errors.push(`${r.repo_full_name}: ${error}`);
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 409 });
    }
    return NextResponse.json({ ok: true, redirect: `/u/${user.username}` });
  }

  // Create new project + link repos — title is required
  if (!title?.trim()) {
    return NextResponse.json({ error: "Project title is required" }, { status: 400 });
  }

  const { error } = await createProjectWithRepos(
    user.userId,
    { title: title.trim() },
    repos.map((r) => ({
      repoFullName: r.repo_full_name,
      repoUrl: r.repo_url,
      installationId,
    }))
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redirect: `/u/${user.username}` });
}
