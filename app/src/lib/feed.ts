import { createSupabaseAdmin } from "./supabase";
import type { FeedItem } from "./types";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdmin>;

export interface FeedQueryOpts {
  cursor?: string | null;
  category?: string | null;
  limit?: number;
  sessionUserId?: string | null;
}

async function buildHeartedSet(
  supabase: SupabaseAdminClient,
  sessionUserId: string,
  items: Record<string, unknown>[]
): Promise<Set<string>> {
  const activityIds = items.map((r) => r.id as string).filter(Boolean);
  if (activityIds.length === 0) return new Set();
  const { data: heartRows } = await supabase
    .from("hearts")
    .select("post_id")
    .eq("user_id", sessionUserId)
    .in("post_id", activityIds);
  return new Set((heartRows ?? []).map((h: { post_id: string }) => h.post_id));
}

function paginateRows(
  rows: Record<string, unknown>[],
  limit: number
): { items: Record<string, unknown>[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? (items[items.length - 1].last_commit_at as string | null | undefined) ?? null
      : null;
  return { items, nextCursor };
}

function mapRow(
  row: Record<string, unknown>,
  heartedSet: Set<string>,
  includeUser: boolean
): FeedItem {
  const users = row.users as Record<string, unknown> | null;
  const projects = row.projects as Record<string, unknown> | null;
  const projectRepos = row.project_repos as Record<string, unknown> | null;
  const id = row.id as string | undefined;

  const item: FeedItem = {
    project: projects
      ? {
          title: projects.title as string,
          id: projects.id as string,
          slug: projects.slug as string | null | undefined,
        }
      : null,
    repo: projectRepos
      ? {
          repo_full_name: projectRepos.repo_full_name as string,
          repo_url: projectRepos.repo_url as string,
        }
      : null,
    activity: {
      id,
      date_utc: row.date_utc as string | undefined,
      type: row.type as string | undefined,
      content_text: row.content_text as string | null | undefined,
      content_image_url: row.content_image_url as string | null | undefined,
      commit_count: row.commit_count as number | undefined,
      first_commit_at: row.first_commit_at as string | null | undefined,
      last_commit_at: row.last_commit_at as string | null | undefined,
      github_link: row.github_link as string | null | undefined,
      commit_messages: row.commit_messages as string[] | null | undefined,
      hearts_count: row.hearts_count as number | undefined,
      comments_count: row.comments_count as number | undefined,
      hearted: id ? heartedSet.has(id) : false,
    },
  };

  if (includeUser && users) {
    item.user = {
      username: users.username as string,
      avatar_url: users.avatar_url as string | null,
    };
  }

  return item;
}

export async function queryFeed(opts: FeedQueryOpts): Promise<{
  feed: FeedItem[];
  nextCursor: string | null;
  dbError: unknown;
}> {
  const { cursor, category, limit: limitOpt = 20, sessionUserId } = opts;
  const limit = Math.min(limitOpt, 100);
  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("activities")
    .select(
      `id, date_utc, type, content_text, content_image_url, commit_count,
       first_commit_at, last_commit_at, github_link, commit_messages,
       hearts_count, comments_count, user_id, project_id, project_repo_id,
       users!inner(id, username, avatar_url),
       projects(id, title, slug, active, category),
       project_repos(repo_full_name, repo_url)`
    )
    .order("last_commit_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt("last_commit_at", cursor);

  if (category) {
    const { data: catProjects } = await supabase
      .from("projects")
      .select("id")
      .ilike("category", category);
    const projectIds = (catProjects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) return { feed: [], nextCursor: null, dbError: null };
    query = query.in("project_id", projectIds);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return { feed: [], nextCursor: null, dbError: error };

  const { items, nextCursor } = paginateRows(rows as Record<string, unknown>[], limit);
  const heartedSet = sessionUserId
    ? await buildHeartedSet(supabase, sessionUserId, items)
    : new Set<string>();

  return {
    feed: items.map((row) => mapRow(row, heartedSet, true)),
    nextCursor,
    dbError: null,
  };
}

export async function queryUserFeed(
  userId: string,
  opts: FeedQueryOpts
): Promise<{
  feed: FeedItem[];
  nextCursor: string | null;
  dbError: unknown;
}> {
  const { cursor, category, limit: limitOpt = 20, sessionUserId } = opts;
  const limit = Math.min(limitOpt, 100);
  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("activities")
    .select(
      `id, date_utc, type, content_text, content_image_url, commit_count,
       first_commit_at, last_commit_at, github_link, commit_messages,
       hearts_count, comments_count, project_id, project_repo_id,
       projects(id, title, slug, active),
       project_repos(repo_full_name, repo_url)`
    )
    .eq("user_id", userId)
    .order("last_commit_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt("last_commit_at", cursor);

  if (category) {
    const { data: catProjects } = await supabase
      .from("projects")
      .select("id")
      .ilike("category", category);
    const projectIds = (catProjects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) return { feed: [], nextCursor: null, dbError: null };
    query = query.in("project_id", projectIds);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return { feed: [], nextCursor: null, dbError: error };

  const { items, nextCursor } = paginateRows(rows as Record<string, unknown>[], limit);
  const heartedSet = sessionUserId
    ? await buildHeartedSet(supabase, sessionUserId, items)
    : new Set<string>();

  return {
    feed: items.map((row) => mapRow(row, heartedSet, false)),
    nextCursor,
    dbError: null,
  };
}
