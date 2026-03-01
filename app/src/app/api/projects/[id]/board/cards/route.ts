import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if ((project as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { column_id?: string; title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const columnId = typeof body?.column_id === "string" ? body.column_id.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "Title must be 200 characters or fewer" }, { status: 400 });
  }
  if (!columnId) {
    return NextResponse.json({ error: "column_id is required" }, { status: 400 });
  }

  const description = typeof body?.description === "string" ? body.description.trim() : null;
  if (description && description.length > 2000) {
    return NextResponse.json({ error: "Description must be 2000 characters or fewer" }, { status: 400 });
  }

  // Verify column belongs to this project
  const { data: col } = await supabase
    .from("project_board_columns")
    .select("id")
    .eq("id", columnId)
    .eq("project_id", id)
    .maybeSingle();

  if (!col) {
    return NextResponse.json({ error: "Column not found in this project" }, { status: 404 });
  }

  const { data: maxRow } = await supabase
    .from("project_board_cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = maxRow ? (maxRow as { position: number }).position + 1 : 0;

  const { data: card, error: insertErr } = await supabase
    .from("project_board_cards")
    .insert({ project_id: id, column_id: columnId, title, description, position: nextPosition })
    .select("id, column_id, title, description, position")
    .single();

  if (insertErr || !card) {
    console.error("POST /api/projects/[id]/board/cards error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ card }, { status: 201 });
}
