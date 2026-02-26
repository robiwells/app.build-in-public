import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("project_comments")
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const comments = (rows ?? []).map((c: Record<string, unknown>) => {
    const u = c.users as Record<string, unknown> | null;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      user_id: c.user_id,
      user: u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null,
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: string;
  try {
    const json = await req.json();
    body = typeof json?.body === "string" ? json.body.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: "Body must be 1000 characters or fewer" }, { status: 400 });
  }

  const { data: comment, error: insertErr } = await supabase
    .from("project_comments")
    .insert({ project_id: id, user_id: userId, body })
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .single();

  if (insertErr || !comment) {
    console.error("POST /api/projects/[id]/comments error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const u = (comment as Record<string, unknown>).users as Record<string, unknown> | null;
  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        user: u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null,
      },
    },
    { status: 201 }
  );
}
