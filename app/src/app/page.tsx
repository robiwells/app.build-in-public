import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ActivityItem } from "@/components/ActivityItem";

export const revalidate = 30;

type FeedItem = {
  user?: { username?: string; avatar_url?: string | null } | null;
  project?: { repo_full_name?: string; repo_url?: string } | null;
  activity: {
    id?: string;
    date_utc?: string;
    commit_count?: number;
    last_commit_at?: string | null;
    github_link?: string | null;
  };
};

async function getFeed(cursor?: string): Promise<{ feed: FeedItem[]; nextCursor: string | null }> {
  const supabase = createSupabaseAdmin();
  const limit = 20;

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

  if (error || !rows) return { feed: [], nextCursor: null };

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? (items[items.length - 1] as { last_commit_at?: string | null }).last_commit_at ?? null
      : null;

  const feed = items.map((row: Record<string, unknown>) => {
    const users = row.users as Record<string, unknown> | null;
    const projects = row.projects as Record<string, unknown> | null;
    return {
      user: users
        ? { username: users.username as string, avatar_url: users.avatar_url as string | null }
        : null,
      project: projects
        ? { repo_full_name: projects.repo_full_name as string, repo_url: projects.repo_url as string }
        : null,
      activity: {
        id: row.id as string | undefined,
        date_utc: row.date_utc as string | undefined,
        commit_count: row.commit_count as number | undefined,
        last_commit_at: row.last_commit_at as string | null | undefined,
        github_link: row.github_link as string | null | undefined,
      },
    };
  });

  return { feed, nextCursor };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const { feed, nextCursor } = await getFeed(cursor);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Global activity feed
      </h1>
      {feed.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No activity yet. Sign in with GitHub and track a repo to see commits
          here.
        </p>
      ) : (
        <>
          <div className="space-y-0">
            {feed.map((item) => (
              <ActivityItem
                key={item.activity.id ?? item.activity.date_utc}
                user={item.user}
                project={item.project}
                activity={item.activity}
                showUser={true}
              />
            ))}
          </div>
          {nextCursor && (
            <div className="mt-6">
              <Link
                href={`/?cursor=${encodeURIComponent(nextCursor)}`}
                className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
