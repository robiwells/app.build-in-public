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

  let name: string;
  try {
    const json = await req.json();
    name = typeof json?.name === "string" ? json.name.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: "Name must be 50 characters or fewer" }, { status: 400 });
  }

  const { data: maxRow } = await supabase
    .from("project_board_columns")
    .select("position")
    .eq("project_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = maxRow ? (maxRow as { position: number }).position + 1 : 0;

  const { data: column, error: insertErr } = await supabase
    .from("project_board_columns")
    .insert({ project_id: id, name, position: nextPosition })
    .select("id, name, position")
    .single();

  if (insertErr || !column) {
    console.error("POST /api/projects/[id]/board/columns error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ column }, { status: 201 });
}
