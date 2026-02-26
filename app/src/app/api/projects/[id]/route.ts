import { auth } from "@/lib/auth";
import { updateProject, deleteProject } from "@/lib/projects";
import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
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

  const supabase = createSupabaseAdmin();
  const { data: rawProject, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      slug,
      category,
      xp,
      level,
      created_at,
      active,
      project_connector_sources(id, external_id, url, active, connector_type, user_connectors(external_id))
    `
    )
    .eq("id", id)
    .eq("user_id", user.userId)
    .eq("active", true)
    .single();

  if (error || !rawProject) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { project_connector_sources: sources, ...rest } = rawProject as Record<string, unknown>;
  const project = {
    ...rest,
    project_repos: ((sources as Array<Record<string, unknown>>) ?? [])
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        connector_type: s.connector_type,
        repo_full_name: s.external_id,
        repo_url: s.connector_type === "medium"
          ? `https://medium.com/${s.external_id as string}`
          : s.url,
        installation_id: parseInt(
          ((s.user_connectors as Record<string, unknown> | null)?.external_id as string) ?? "0",
          10
        ),
        active: s.active,
      })),
  };

  return NextResponse.json({ project });
}

export async function PATCH(
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

  let body: { title?: string; description?: string | null; url?: string | null; category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const { error } = await updateProject(id, user.userId, {
    title: body.title?.trim(),
    description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
    url: body.url !== undefined ? (body.url?.trim() || null) : undefined,
    category: body.category !== undefined ? body.category : undefined,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
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

  const { error } = await deleteProject(id, user.userId);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
