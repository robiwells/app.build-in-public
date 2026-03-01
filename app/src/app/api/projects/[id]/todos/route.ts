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

  let text: string;
  try {
    const json = await req.json();
    text = typeof json?.text === "string" ? json.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > 200) {
    return NextResponse.json({ error: "Text must be 200 characters or fewer" }, { status: 400 });
  }

  const { data: maxRow } = await supabase
    .from("project_todos")
    .select("position")
    .eq("project_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = maxRow ? (maxRow as { position: number }).position + 1 : 0;

  const { data: todo, error: insertErr } = await supabase
    .from("project_todos")
    .insert({ project_id: id, text, position: nextPosition })
    .select("id, text, completed, position")
    .single();

  if (insertErr || !todo) {
    console.error("POST /api/projects/[id]/todos error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ todo }, { status: 201 });
}
