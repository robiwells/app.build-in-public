import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type OwnedItem = {
  id: string;
  card_id: string;
  project_board_cards: {
    project_id: string;
    projects: { user_id: string };
  };
};

async function getOwnedItem(itemId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: item } = await supabase
    .from("project_board_checklist_items")
    .select("id, card_id, project_board_cards(project_id, projects(user_id))")
    .eq("id", itemId)
    .maybeSingle() as { data: OwnedItem | null };

  if (!item) return { item: null, supabase, error: "not_found" as const };
  if (item.project_board_cards.projects.user_id !== userId) return { item: null, supabase, error: "forbidden" as const };

  return { item, supabase, error: null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { item, supabase, error } = await getOwnedItem(itemId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { text?: string; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.text === undefined && body.completed === undefined) {
    return NextResponse.json({ error: "At least one field required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (text.length > 200) return NextResponse.json({ error: "Text must be 200 characters or fewer" }, { status: 400 });
    updates.text = text;
  }

  if (body.completed !== undefined) {
    updates.completed = Boolean(body.completed);
  }

  const { error: updateErr } = await supabase
    .from("project_board_checklist_items")
    .update(updates)
    .eq("id", item!.id);

  if (updateErr) {
    console.error("PATCH /api/board/checklist/[itemId] error:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { item, supabase, error } = await getOwnedItem(itemId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteErr } = await supabase
    .from("project_board_checklist_items")
    .delete()
    .eq("id", item!.id);

  if (deleteErr) {
    console.error("DELETE /api/board/checklist/[itemId] error:", deleteErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
