import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type OwnedTodo = { id: string; project_id: string; projects: { user_id: string } };

async function getOwnedTodo(todoId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: todo } = await supabase
    .from("project_todos")
    .select("id, project_id, projects(user_id)")
    .eq("id", todoId)
    .maybeSingle() as { data: OwnedTodo | null };

  if (!todo) return { todo: null, supabase, error: "not_found" as const };

  if (todo.projects.user_id !== userId) {
    return { todo: null, supabase, error: "forbidden" as const };
  }

  return { todo, supabase, error: null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ todoId: string }> }
) {
  const { todoId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { todo, supabase, error } = await getOwnedTodo(todoId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { completed?: boolean; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.completed === undefined && body.text === undefined) {
    return NextResponse.json({ error: "At least one field required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.completed !== undefined) updates.completed = body.completed;
  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (text.length > 200) return NextResponse.json({ error: "Text must be 200 characters or fewer" }, { status: 400 });
    updates.text = text;
  }

  const { error: updateErr } = await supabase
    .from("project_todos")
    .update(updates)
    .eq("id", todo!.id);

  if (updateErr) {
    console.error("PATCH /api/todos/[todoId] error:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ todoId: string }> }
) {
  const { todoId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { todo, supabase, error } = await getOwnedTodo(todoId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteErr } = await supabase
    .from("project_todos")
    .delete()
    .eq("id", todo!.id);

  if (deleteErr) {
    console.error("DELETE /api/todos/[todoId] error:", deleteErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
