import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const session = await auth();
  const userId = (session?.user as { userId?: string })?.userId;

  const supabase = createSupabaseAdmin();

  const { data: row, error } = await supabase
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
      users(id, username, avatar_url),
      projects(id, title, category),
      project_repos(repo_full_name, repo_url)
    `
    )
    .eq("id", postId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const r = row as Record<string, unknown>;
  const u = r.users as Record<string, unknown> | null;
  const p = r.projects as Record<string, unknown> | null;
  const repo = r.project_repos as Record<string, unknown> | null;

  // Fetch comments
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const commentList = (comments ?? []).map((c: Record<string, unknown>) => {
    const cu = c.users as Record<string, unknown> | null;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      user: cu ? { id: cu.id, username: cu.username, avatar_url: cu.avatar_url } : null,
    };
  });

  // Check hearted status
  let hearted = false;
  if (userId) {
    const { data: heart } = await supabase
      .from("hearts")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();
    hearted = !!heart;
  }

  return NextResponse.json({
    activity: {
      id: r.id,
      date_utc: r.date_utc,
      type: r.type,
      content_text: r.content_text,
      content_image_url: r.content_image_url,
      commit_count: r.commit_count,
      first_commit_at: r.first_commit_at,
      last_commit_at: r.last_commit_at,
      github_link: r.github_link,
      commit_messages: r.commit_messages,
      hearts_count: r.hearts_count,
      comments_count: r.comments_count,
    },
    user: u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null,
    project: p ? { id: p.id, title: p.title, category: p.category } : null,
    repo: repo ? { repo_full_name: repo.repo_full_name, repo_url: repo.repo_url } : null,
    heartCount: (r.hearts_count as number) ?? 0,
    hearted,
    comments: commentList,
  });
}
