import { auth } from "@/lib/auth";
import { upsertProject } from "@/lib/projects";
import { NextResponse } from "next/server";
import { verifySetupToken } from "@/lib/github-app";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string; username?: string };
  if (!user.userId || !user.username) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: { token?: string; repo_full_name?: string; repo_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, repo_full_name, repo_url } = body;
  const installationId = verifySetupToken(token ?? null);
  if (installationId === null) {
    return NextResponse.json({ error: "Invalid or expired setup token" }, { status: 400 });
  }
  if (!repo_full_name || !repo_url) {
    return NextResponse.json(
      { error: "repo_full_name and repo_url required" },
      { status: 400 }
    );
  }

  const { error } = await upsertProject(user.userId, {
    repoFullName: repo_full_name,
    repoUrl: repo_url,
    installationId,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redirect: `/u/${user.username}` });
}
