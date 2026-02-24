import Link from "next/link";
import Image from "next/image";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ActivityItem } from "@/components/ActivityItem";
import { Composer } from "@/components/Composer";
import { auth } from "@/lib/auth";

export const revalidate = 30;

type FeedItem = {
  user?: { username?: string; avatar_url?: string | null } | null;
  project?: { title?: string; id?: string } | null;
  repo?: { repo_full_name?: string; repo_url?: string } | null;
  activity: {
    id?: string;
    date_utc?: string;
    type?: string;
    content_text?: string | null;
    content_image_url?: string | null;
    commit_count?: number;
    first_commit_at?: string | null;
    last_commit_at?: string | null;
    github_link?: string | null;
    commit_messages?: string[] | null;
  };
};

type HomeFeedGroup = {
  key: string;
  user: { username: string; avatar_url: string | null } | null;
  project: { title?: string; id?: string } | null;
  date: string; // YYYY-MM-DD
  latestTimestamp: string | null;
  items: FeedItem[];
};

function groupHomeFeed(items: FeedItem[]): HomeFeedGroup[] {
  const map = new Map<string, HomeFeedGroup>();

  for (const item of items) {
    const username = item.user?.username ?? "unknown";
    const date = item.activity.date_utc ?? "";
    const projectId = item.project?.id ?? "none";
    const key = `${username}_${projectId}_${date}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        user: item.user
          ? { username: item.user.username ?? "", avatar_url: item.user.avatar_url ?? null }
          : null,
        project: item.project ?? null,
        date,
        latestTimestamp: null,
        items: [],
      });
    }

    const group = map.get(key)!;
    group.items.push(item);

    const ts = item.activity.last_commit_at ?? null;
    if (ts && (!group.latestTimestamp || ts > group.latestTimestamp)) {
      group.latestTimestamp = ts;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (!a.latestTimestamp && !b.latestTimestamp) return 0;
    if (!a.latestTimestamp) return 1;
    if (!b.latestTimestamp) return -1;
    return b.latestTimestamp.localeCompare(a.latestTimestamp);
  });
}

function formatGroupDate(dateUtc: string): string {
  const [y, m, d] = dateUtc.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", day: "numeric" });
}

async function getFeed(cursor?: string): Promise<{ feed: FeedItem[]; nextCursor: string | null }> {
  const supabase = createSupabaseAdmin();
  const limit = 20;

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
      user_id,
      project_id,
      project_repo_id,
      users!inner(id, username, avatar_url),
      projects(id, title, active),
      project_repos(repo_full_name, repo_url)
    `
    )
    .order("last_commit_at", { ascending: false })
    .order("id", { ascending: false })
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
        type: row.type as string | undefined,
        content_text: row.content_text as string | null | undefined,
        content_image_url: row.content_image_url as string | null | undefined,
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

async function getSessionUserData(userId: string): Promise<{
  username: string;
  timezone: string;
  projects: { id: string; title: string }[];
} | null> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("username, timezone, projects(id, title, active)")
    .eq("id", userId)
    .eq("projects.active", true)
    .maybeSingle();
  if (!data) return null;
  const projects = (data.projects as { id: string; title: string; active: boolean }[] ?? []);
  return { username: data.username, timezone: data.timezone, projects };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [{ feed, nextCursor }, session] = await Promise.all([getFeed(cursor), auth()]);

  const sessionUser = session?.user as { userId?: string } | undefined;
  const sessionUserData = sessionUser?.userId
    ? await getSessionUserData(sessionUser.userId)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Activity feed
      </h1>

      {sessionUser?.userId && sessionUserData && (
        <Composer
          userId={sessionUser.userId}
          projects={sessionUserData.projects}
          timezone={sessionUserData.timezone}
        />
      )}

      {feed.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          It&apos;s quiet... too quiet.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {groupHomeFeed(feed).map((group) => {
              const profileHref = group.user?.username ? `/u/${group.user.username}` : undefined;
              const groupProjectHref =
                group.user?.username && group.project?.id
                  ? `/u/${group.user.username}/projects/${group.project.id}`
                  : undefined;
              return (
                <div key={group.key} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {group.user?.avatar_url ? (
                        <Image
                          src={group.user.avatar_url}
                          alt={group.user.username}
                          width={24}
                          height={24}
                          className="rounded-full shrink-0"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {(group.user?.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      {profileHref ? (
                        <Link href={profileHref} className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline truncate">
                          {group.user?.username}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{group.user?.username}</span>
                      )}
                      {group.project?.title && (
                        <>
                          <span className="text-zinc-400 dark:text-zinc-600 text-sm">·</span>
                          {groupProjectHref ? (
                            <Link href={groupProjectHref} className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline truncate">
                              {group.project.title}
                            </Link>
                          ) : (
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{group.project.title}</span>
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">{formatGroupDate(group.date)}</span>
                  </div>
                  {/* Items */}
                  <div className="px-4">
                    {group.items.map((item) => {
                      const projectHref =
                        item.user?.username && item.project?.id
                          ? `/u/${item.user.username}/projects/${item.project.id}`
                          : undefined;
                      return (
                        <ActivityItem
                          key={item.activity.id ?? item.activity.date_utc}
                          user={null}
                          project={item.project}
                          repo={item.repo}
                          activity={item.activity}
                          showUser={false}
                          showProject={false}
                          projectHref={projectHref}
                        />
                      );
                    })}
                  </div>
                </div>
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
