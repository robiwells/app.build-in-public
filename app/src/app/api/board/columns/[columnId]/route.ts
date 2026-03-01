import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type OwnedColumn = { id: string; project_id: string; projects: { user_id: string } };

async function getOwnedColumn(columnId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: col } = await supabase
    .from("project_board_columns")
    .select("id, project_id, projects(user_id)")
    .eq("id", columnId)
    .maybeSingle() as { data: OwnedColumn | null };

  if (!col) return { col: null, supabase, error: "not_found" as const };
  if (col.projects.user_id !== userId) return { col: null, supabase, error: "forbidden" as const };

  return { col, supabase, error: null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ columnId: string }> }
) {
  const { columnId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { col, supabase, error } = await getOwnedColumn(columnId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; position?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.name === undefined && body.position === undefined) {
    return NextResponse.json({ error: "At least one field required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (name.length > 50) return NextResponse.json({ error: "Name must be 50 characters or fewer" }, { status: 400 });
    updates.name = name;
  }
  if (body.position !== undefined) {
    updates.position = body.position;
  }

  const { error: updateErr } = await supabase
    .from("project_board_columns")
    .update(updates)
    .eq("id", col!.id);

  if (updateErr) {
    console.error("PATCH /api/board/columns/[columnId] error:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ columnId: string }> }
) {
  const { columnId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { col, supabase, error } = await getOwnedColumn(columnId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteErr } = await supabase
    .from("project_board_columns")
    .delete()
    .eq("id", col!.id);

  if (deleteErr) {
    console.error("DELETE /api/board/columns/[columnId] error:", deleteErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
