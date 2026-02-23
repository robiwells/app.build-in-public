import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("activities")
    .select(
      `
      id,
      date_utc,
      commit_count,
      first_commit_at,
      last_commit_at,
      github_link,
      user_id,
      project_id,
      users!inner(id, username, avatar_url),
      projects!inner(repo_full_name, repo_url, active)
    `
    )
    .eq("projects.active", true)
    .order("last_commit_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("last_commit_at", cursor);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasMore = (rows?.length ?? 0) > limit;
  const items = hasMore ? rows!.slice(0, limit) : rows ?? [];
  const nextCursor = hasMore && items.length > 0
    ? (items[items.length - 1] as { last_commit_at?: string }).last_commit_at
    : null;

  const feed = items.map((row: Record<string, unknown>) => {
    const users = row.users as Record<string, unknown> | null;
    const projects = row.projects as Record<string, unknown> | null;
    return {
      user: users
        ? { id: users.id, username: users.username, avatar_url: users.avatar_url }
        : null,
      project: projects
        ? { repo_full_name: projects.repo_full_name, repo_url: projects.repo_url }
        : null,
      activity: {
        id: row.id,
        date_utc: row.date_utc,
        commit_count: row.commit_count,
        first_commit_at: row.first_commit_at,
        last_commit_at: row.last_commit_at,
        github_link: row.github_link,
      },
    };
  });

  return NextResponse.json({ feed, nextCursor });
}
