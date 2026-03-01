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
    .from("project_board_cards")
    .delete()
    .eq("column_id", col!.id);

  if (deleteErr) {
    console.error("DELETE /api/board/columns/[columnId]/cards error:", deleteErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
