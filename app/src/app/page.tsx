import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ActivityItem } from "@/components/ActivityItem";

export const revalidate = 30;

type FeedItem = {
  user?: { username?: string; avatar_url?: string | null } | null;
  project?: { title?: string; id?: string } | null;
  repo?: { repo_full_name?: string; repo_url?: string } | null;
  activity: {
    id?: string;
    date_utc?: string;
    commit_count?: number;
    first_commit_at?: string | null;
    last_commit_at?: string | null;
    github_link?: string | null;
    commit_messages?: string[] | null;
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
      commit_messages,
      user_id,
      project_id,
      project_repo_id,
      users!inner(id, username, avatar_url),
      projects!inner(id, title, active),
      project_repos(repo_full_name, repo_url)
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
    const projectRepos = row.project_repos as Record<string, unknown> | null;
    return {
      user: users
        ? { username: users.username as string, avatar_url: users.avatar_url as string | null }
        : null,
      project: projects
        ? { title: projects.title as string, id: projects.id as string }
        : null,
      repo: projectRepos
        ? { repo_full_name: projectRepos.repo_full_name as string, repo_url: projectRepos.repo_url as string }
        : null,
      activity: {
        id: row.id as string | undefined,
        date_utc: row.date_utc as string | undefined,
        commit_count: row.commit_count as number | undefined,
        first_commit_at: row.first_commit_at as string | null | undefined,
        last_commit_at: row.last_commit_at as string | null | undefined,
        github_link: row.github_link as string | null | undefined,
        commit_messages: row.commit_messages as string[] | null | undefined,
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
        Activity feed
      </h1>
      {feed.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          It&apos;s quiet... too quiet.
        </p>
      ) : (
        <>
          <div className="space-y-0">
            {feed.map((item) => {
              const projectHref =
                item.user?.username && item.project?.id
                  ? `/u/${item.user.username}/projects/${item.project.id}`
                  : undefined;
              return (
                <ActivityItem
                  key={item.activity.id ?? item.activity.date_utc}
                  user={item.user}
                  project={item.project}
                  repo={item.repo}
                  activity={item.activity}
                  showUser={true}
                  projectHref={projectHref}
                />
              );
            })}
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
