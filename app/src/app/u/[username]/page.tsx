import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ActivityItem } from "@/components/ActivityItem";

export const revalidate = 30;

type FeedItem = {
  project?: { repo_full_name?: string; repo_url?: string } | null;
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

async function getUserFeed(
  username: string,
  cursor?: string
): Promise<{
  user: { username: string; avatar_url: string | null };
  feed: FeedItem[];
  nextCursor: string | null;
} | null> {
  const supabase = createSupabaseAdmin();
  const limit = 20;

  const pattern = username
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: user } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .ilike("username", pattern)
    .maybeSingle();

  if (!user) return null;

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
      project_id,
      projects!inner(repo_full_name, repo_url, active)
    `
    )
    .eq("user_id", user.id)
    .eq("projects.active", true)
    .order("last_commit_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("last_commit_at", cursor);
  }

  const { data: rows, error } = await query;

  if (error || !rows) return { user, feed: [], nextCursor: null };

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? (items[items.length - 1] as { last_commit_at?: string | null }).last_commit_at ?? null
      : null;

  const feed = items.map((row: Record<string, unknown>) => {
    const projects = row.projects as Record<string, unknown> | null;
    return {
      project: projects
        ? { repo_full_name: projects.repo_full_name as string, repo_url: projects.repo_url as string }
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

  return { user, feed, nextCursor };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { username } = await params;
  const { cursor } = await searchParams;
  const data = await getUserFeed(username, cursor);

  if (!data) notFound();

  const { user, feed, nextCursor } = data;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center gap-4">
        {user?.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt=""
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-2xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {(user?.username ?? "?")[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {user?.username ?? username}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            GitHub activity
          </p>
        </div>
      </header>

      {feed.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No activity yet.</p>
      ) : (
        <>
          <div className="space-y-0">
            {feed.map((item) => (
              <ActivityItem
                key={item.activity.id ?? item.activity.date_utc}
                user={null}
                project={item.project}
                activity={item.activity}
                showUser={false}
              />
            ))}
          </div>
          {nextCursor && (
            <div className="mt-6">
              <Link
                href={`/u/${username}?cursor=${encodeURIComponent(nextCursor)}`}
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
