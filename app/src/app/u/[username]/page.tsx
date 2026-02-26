import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { FeedRefresh } from "@/components/FeedRefresh";
import { ProjectManager } from "@/components/ProjectManager";
import { ProfileBioEditor } from "@/components/ProfileBioEditor";
import { levelProgressPct } from "@/lib/xp";
import { queryUserFeed } from "@/lib/feed";
import { ConsistencyGrid } from "@/components/ConsistencyGrid";
import type { FeedItem } from "@/lib/types";

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
  slug: string | null;
  xp: number;
  level: number;
  project_repos: Repo[];
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
    const key = item.activity.type === "milestone"
      ? `milestone_${item.activity.id}`
      : date || "unknown";

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

async function getUserData(
  username: string,
  cursor?: string,
  sessionUserId?: string
): Promise<{
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    timezone: string;
  };
  projects: ProjectSummary[];
  feed: FeedItem[];
  nextCursor: string | null;
} | null> {
  const supabase = createSupabaseAdmin();

  const pattern = username
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, avatar_url, bio, timezone")
    .ilike("username", pattern)
    .maybeSingle();

  if (userError) {
    console.error("getUserData error:", userError.message);
    return null;
  }
  if (!user) return null;

  // Fetch user's active projects with connector sources
  const { data: rawProjects } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      slug,
      xp,
      level,
      project_connector_sources!left(id, external_id, url, active, connector_type)
    `
    )
    .eq("user_id", user.id)
    .eq("project_connector_sources.active", true)
    .eq("active", true)
    .order("created_at", { ascending: false });

  // Remap to backward-compatible shape
  const projects = (rawProjects ?? []).map((p) => {
    const { project_connector_sources: sources, ...rest } = p as Record<string, unknown>;
    return {
      ...rest,
      project_repos: ((sources as Array<Record<string, unknown>>) ?? []).map((s) => ({
        id: s.id,
        connector_type: s.connector_type,
        repo_full_name: s.connector_type === "medium"
          ? `Medium: ${s.external_id as string}`
          : s.external_id,
        repo_url: s.connector_type === "medium"
          ? `https://medium.com/${s.external_id as string}`
          : s.url,
        active: s.active,
      })),
    };
  });

  const { feed, nextCursor } = await queryUserFeed(user.id, { cursor, sessionUserId });

  return {
    user,
    projects: (projects as unknown as ProjectSummary[]) ?? [],
    feed,
    nextCursor,
  };
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
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const data = await getUserData(username, cursor, sessionUser?.userId);

  if (!data) notFound();

  const { user, projects, feed, nextCursor } = data;
  const isOwner = sessionUser?.userId === user.id;

  // Activity counts per day for heatmap (date_local from activities)
  const supabase = createSupabaseAdmin();
  const { data: activityRows } = await supabase
    .from("activities")
    .select("date_local")
    .eq("user_id", user.id)
    .not("date_local", "is", null)
    .order("date_local", { ascending: false });
  const countMap = new Map<string, number>();
  for (const row of activityRows ?? []) {
    const d = row.date_local as string;
    countMap.set(d, (countMap.get(d) ?? 0) + 1);
  }
  const activityData = [...countMap.entries()].map(([date, count]) => ({ date, count }));

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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f0e8] text-2xl font-medium text-[#78716c]">
            {(user?.username ?? "?")[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[#2a1f14]">
            {user?.username ?? username}
          </h1>
          <ProfileBioEditor bio={user.bio} isOwner={isOwner} />
        </div>
      </header>

      {/* Activity heatmap */}
      <section className="mb-8">
        <ConsistencyGrid activityData={activityData} timezone={user.timezone} />
      </section>

      {/* Projects section */}
      {isOwner ? (
        <section className="mb-8">
          <ProjectManager username={username} />
        </section>
      ) : projects.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#2a1f14]">
            Projects
          </h2>
          <div className="space-y-3">
            {projects.map((p) => {
              const displayUrl =
                p.url ?? (p.project_repos?.[0] as { repo_url?: string } | undefined)?.repo_url ?? null;
              return (
                <Link key={p.id} href={`/u/${username}/projects/${p.slug?.trim() ? p.slug : p.id}`}>
                  <div className="card rounded-xl p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(120,80,40,0.14)]">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#2a1f14]">
                        {p.title}
                      </h3>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Level {p.level}
                      </span>
                    </div>
                    {p.description && (
                      <p className="mt-1 text-sm text-[#78716c]">
                        {p.description}
                      </p>
                    )}
                    {displayUrl && (
                      <p className="mt-1 text-sm text-[#b5522a]">
                        {displayUrl.replace(/^https?:\/\//, "")}
                      </p>
                    )}
                    {p.project_repos.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {p.project_repos.map((repo) => (
                          <p
                            key={repo.id}
                            className="block rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm text-[#78716c]"
                          >
                            {repo.repo_full_name}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 overflow-hidden rounded-full bg-[#e8ddd0]" style={{ height: "6px" }}>
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${levelProgressPct(p.xp, p.level)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Activity feed */}
      <section>
        <FeedRefresh />
        <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#2a1f14]">Activity</h2>
        {feed.length === 0 ? (
          <p className="text-[#78716c]">No activity yet.</p>
        ) : (
          <>
            <div className="space-y-4">
              {groupFeedItems(feed).map((group) => (
                <div key={group.key} className={`overflow-hidden rounded-xl ${group.items.some(i => i.activity.type === "milestone") ? "border border-amber-300 shadow-[0_1px_3px_rgba(120,80,40,0.10)]" : "card"}`}>
                  {/* Group header — date only */}
                  <div className="border-b border-[#e8ddd0] bg-[#f5f0e8] px-4 py-2.5">
                    <span className="text-sm font-medium text-[#78716c]">{formatGroupDate(group.date)}</span>
                  </div>
                  {/* Items — each shows its own project name */}
                  <div className="px-4">
                    {group.items.map((item) => {
                      const projectHref = item.project?.id
                        ? `/u/${username}/projects/${item.project?.slug?.trim() ? item.project.slug : item.project?.id}`
                        : undefined;
                      const postHref = item.activity.id
                        ? `/p/${item.activity.id}`
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
                          heartCount={item.activity.hearts_count}
                          commentCount={item.activity.comments_count}
                          hearted={item.activity.hearted}
                          currentUserId={sessionUser?.userId ?? null}
                          postHref={postHref}
                          canDelete={isOwner}
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
                  className="text-sm font-medium text-[#78716c] hover:text-[#b5522a]"
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
