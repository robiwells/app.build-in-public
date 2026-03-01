import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: card } = await supabase
    .from("project_board_cards")
    .select("id, project_id, projects(user_id)")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (card.projects.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  if (text.length > 200) return NextResponse.json({ error: "Text must be 200 characters or fewer" }, { status: 400 });

  const { data: maxRow } = await supabase
    .from("project_board_checklist_items")
    .select("position")
    .eq("card_id", cardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = maxRow ? maxRow.position + 1 : 0;

  const { data: item, error: insertErr } = await supabase
    .from("project_board_checklist_items")
    .insert({ card_id: cardId, project_id: card.project_id, text, position })
    .select("id, card_id, text, completed, position")
    .single();

  if (insertErr) {
    console.error("POST /api/board/cards/[cardId]/checklist error:", insertErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
