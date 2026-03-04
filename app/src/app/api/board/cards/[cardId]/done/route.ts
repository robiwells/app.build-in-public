import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { getLocalToday } from "@/lib/date";
import { NextResponse } from "next/server";

type CardWithProject = {
  id: string;
  title: string;
  project_id: string;
  projects: { user_id: string };
};

export async function POST(
  _req: Request,
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
    .select("id, title, project_id, projects(user_id)")
    .eq("id", cardId)
    .maybeSingle() as { data: CardWithProject | null };

  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (card.projects.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const timezone = userRow?.timezone ?? "UTC";

  const now = new Date();
  const dateUtc = now.toISOString().slice(0, 10);
  const dateLocal = getLocalToday(timezone);

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      user_id: userId,
      project_id: card.project_id,
      type: "kanban_done",
      content_text: card.title,
      date_utc: dateUtc,
      date_local: dateLocal,
      commit_count: 0,
      last_commit_at: now.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[done] insert failed", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }

  return NextResponse.json({ xp_awarded: 5, activity }, { status: 201 });
}
