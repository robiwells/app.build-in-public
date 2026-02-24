import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { FeedRefresh } from "@/components/FeedRefresh";
import { ProjectManager } from "@/components/ProjectManager";
import { ProfileBioEditor } from "@/components/ProfileBioEditor";
import { computeStreakStatus } from "@/lib/streak";
import type { Json } from "@/lib/database.types";

export const revalidate = 30;

type Repo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
};

type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  project_repos: Repo[];
};

type FeedItem = {
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

type FeedGroup = {
  key: string;
  date: string; // date_utc YYYY-MM-DD
  latestTimestamp: string | null;
  items: FeedItem[];
};

function groupFeedItems(items: FeedItem[]): FeedGroup[] {
  const map = new Map<string, FeedGroup>();

  for (const item of items) {
    const date = item.activity.date_utc ?? "";
    const key = date || "unknown";

    if (!map.has(key)) {
      map.set(key, {
        key,
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

type StreakMetadata = {
  currentStreak?: number;
  longestStreak?: number;
  lastActiveDayLocal?: string;
};

function parseMetadata(raw: Json | null): StreakMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as StreakMetadata;
}

async function getUserData(
  username: string,
  cursor?: string
): Promise<{
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    timezone: string;
    streak_frozen: boolean;
    streak_metadata: Json | null;
  };
  projects: ProjectSummary[];
  feed: FeedItem[];
  nextCursor: string | null;
} | null> {
  const supabase = createSupabaseAdmin();
  const limit = 20;

  const pattern = username
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, avatar_url, bio, timezone, streak_frozen, streak_metadata")
    .ilike("username", pattern)
    .maybeSingle();

  if (userError) {
    console.error("getUserData error:", userError.message);
    return null;
  }
  if (!user) return null;

  // Fetch user's active projects with repos
  const { data: projects } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      project_repos!left(id, repo_full_name, repo_url, active)
    `
    )
    .eq("user_id", user.id)
    .eq("project_repos.active", true)
    .eq("active", true)
    .order("created_at", { ascending: false });

  // Fetch activity feed
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
      project_id,
      project_repo_id,
      projects(id, title, active),
      project_repos(repo_full_name, repo_url)
    `
    )
    .eq("user_id", user.id)
    .order("last_commit_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("last_commit_at", cursor);
  }

  const { data: rows, error } = await query;

  if (error || !rows) {
    return {
      user,
      projects: (projects as ProjectSummary[]) ?? [],
      feed: [],
      nextCursor: null,
    };
  }

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? (items[items.length - 1] as { last_commit_at?: string | null }).last_commit_at ?? null
      : null;

  const feed = items.map((row: Record<string, unknown>) => {
    const proj = row.projects as Record<string, unknown> | null;
    const projectRepos = row.project_repos as Record<string, unknown> | null;
    return {
      project: proj ? { title: proj.title as string, id: proj.id as string } : null,
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

  return {
    user,
    projects: (projects as ProjectSummary[]) ?? [],
    feed,
    nextCursor,
  };
}

const STATUS_STYLES: Record<string, string> = {
  Safe: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "At Risk": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Frozen: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  New: "",
};

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { username } = await params;
  const { cursor } = await searchParams;
  const data = await getUserData(username, cursor);

  if (!data) notFound();

  const { user, projects, feed, nextCursor } = data;

  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const isOwner = sessionUser?.userId === user.id;

  const meta = parseMetadata(user.streak_metadata);
  const streakStatus = computeStreakStatus(
    meta.lastActiveDayLocal ?? null,
    user.timezone,
    user.streak_frozen
  );
  const currentStreak = meta.currentStreak ?? 0;

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
          <ProfileBioEditor bio={user.bio} isOwner={isOwner} />
        </div>
      </header>

      {/* Streak summary */}
      {streakStatus !== "New" && (
        <Link href={`/u/${username}/streaks`} className="block mb-8">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 transition-colors">
            <span className="text-2xl">🔥</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {currentStreak}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">day streak</span>
              {streakStatus !== "Safe" && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[streakStatus] ?? ""}`}>
                  {streakStatus}
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Projects section */}
      {isOwner ? (
        <section className="mb-8">
          <ProjectManager username={username} />
        </section>
      ) : projects.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Projects
          </h2>
          <div className="space-y-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/u/${username}/projects/${p.id}`}>
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {p.description}
                    </p>
                  )}
                  {p.url && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {p.url}
                    </p>
                  )}
                  {p.project_repos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.project_repos.map((repo) => (
                        <p
                          key={repo.id}
                          className="block rounded-lg bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
                        >
                          {repo.repo_full_name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Activity feed */}
      <section>
        <FeedRefresh />
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Activity</h2>
        {feed.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No activity yet.</p>
        ) : (
          <>
            <div className="space-y-4">
              {groupFeedItems(feed).map((group) => (
                <div key={group.key} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {/* Group header — date only */}
                  <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{formatGroupDate(group.date)}</span>
                  </div>
                  {/* Items — each shows its own project name */}
                  <div className="px-4">
                    {group.items.map((item) => {
                      const projectHref = item.project?.id
                        ? `/u/${username}/projects/${item.project.id}`
                        : undefined;
                      return (
                        <ActivityItem
                          key={item.activity.id ?? item.activity.date_utc}
                          user={null}
                          project={item.project}
                          repo={item.repo}
                          activity={item.activity}
                          showUser={false}
                          projectHref={projectHref}
                        />
                      );
                    })}
                  </div>
                </div>
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
      </section>
    </main>
  );
}
