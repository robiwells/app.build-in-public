import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type OwnedCard = { id: string; project_id: string; projects: { user_id: string } };

async function getOwnedCard(cardId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: card } = await supabase
    .from("project_board_cards")
    .select("id, project_id, projects(user_id)")
    .eq("id", cardId)
    .maybeSingle() as { data: OwnedCard | null };

  if (!card) return { card: null, supabase, error: "not_found" as const };
  if (card.projects.user_id !== userId) return { card: null, supabase, error: "forbidden" as const };

  return { card, supabase, error: null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { card, supabase, error } = await getOwnedCard(cardId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { title?: string; description?: string; column_id?: string; position?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.title === undefined &&
    body.description === undefined &&
    body.column_id === undefined &&
    body.position === undefined
  ) {
    return NextResponse.json({ error: "At least one field required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (title.length > 200) return NextResponse.json({ error: "Title must be 200 characters or fewer" }, { status: 400 });
    updates.title = title;
  }
  if (body.description !== undefined) {
    const desc = typeof body.description === "string" ? body.description.trim() : null;
    if (desc && desc.length > 2000) return NextResponse.json({ error: "Description must be 2000 characters or fewer" }, { status: 400 });
    updates.description = desc || null;
  }
  if (body.column_id !== undefined) {
    updates.column_id = body.column_id;
  }
  if (body.position !== undefined) {
    updates.position = body.position;
  }

  const { error: updateErr } = await supabase
    .from("project_board_cards")
    .update(updates)
    .eq("id", card!.id);

  if (updateErr) {
    console.error("PATCH /api/board/cards/[cardId] error:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { card, supabase, error } = await getOwnedCard(cardId, userId);
  if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteErr } = await supabase
    .from("project_board_cards")
    .delete()
    .eq("id", card!.id);

  if (deleteErr) {
    console.error("DELETE /api/board/cards/[cardId] error:", deleteErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
