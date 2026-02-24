import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("activities")
    .select(
      `
      id,
      date_utc,
      type,
      content_text,
      content_image_url,
      commit_count,
      first_commit_at,
      last_commit_at,
      github_link,
      commit_messages,
      hearts_count,
      comments_count,
      user_id,
      project_id,
      project_repo_id,
      users!inner(id, username, avatar_url),
      projects(id, title, active, category),
      project_repos(repo_full_name, repo_url)
    `
    )
    .order("last_commit_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("last_commit_at", cursor);
  }

  if (category) {
    const { data: catProjects } = await supabase
      .from("projects")
      .select("id")
      .ilike("category", category);
    const projectIds = (catProjects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) {
      return NextResponse.json({ feed: [], nextCursor: null });
    }
    query = query.in("project_id", projectIds);
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
    const projectRepos = row.project_repos as Record<string, unknown> | null;
    return {
      user: users
        ? { id: users.id, username: users.username, avatar_url: users.avatar_url }
        : null,
      project: projects
        ? { id: projects.id, title: projects.title }
        : null,
      repo: projectRepos
        ? { repo_full_name: projectRepos.repo_full_name, repo_url: projectRepos.repo_url }
        : null,
      activity: {
        id: row.id,
        date_utc: row.date_utc,
        type: row.type,
        content_text: row.content_text,
        content_image_url: row.content_image_url,
        commit_count: row.commit_count,
        first_commit_at: row.first_commit_at,
        last_commit_at: row.last_commit_at,
        github_link: row.github_link,
        commit_messages: row.commit_messages,
        hearts_count: row.hearts_count,
        comments_count: row.comments_count,
      },
    };
  });

  return NextResponse.json({ feed, nextCursor });
}
