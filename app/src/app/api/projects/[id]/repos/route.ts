import { auth } from "@/lib/auth";
import { addRepoToProject } from "@/lib/projects";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: repos, error } = await supabase
    .from("project_repos")
    .select("id, repo_full_name, repo_url, installation_id, active, created_at")
    .eq("project_id", id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ repos: repos ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { userId?: string };
  if (!user.userId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const { id } = await params;

  let body: { repo_full_name?: string; repo_url?: string; installation_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.repo_full_name || !body.repo_url) {
    return NextResponse.json(
      { error: "repo_full_name and repo_url required" },
      { status: 400 }
    );
  }
  if (typeof body.installation_id !== "number") {
    return NextResponse.json(
      { error: "installation_id required" },
      { status: 400 }
    );
  }

  const { repoId, error } = await addRepoToProject(id, user.userId, {
    repoFullName: body.repo_full_name,
    repoUrl: body.repo_url,
    installationId: body.installation_id,
  });

  if (error) {
    return NextResponse.json({ error }, { status: error === "Project not found" ? 404 : 409 });
  }

  return NextResponse.json({ ok: true, repoId }, { status: 201 });
}
