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
import { OwnerFeaturedProject } from "@/components/OwnerFeaturedProject";
import type { FeedItem } from "@/lib/types";

export const revalidate = 30;

type Repo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
  connector_type?: string;
};

type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  slug: string | null;
  category: string | null;
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

function formatJoinDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString([], { month: "short", year: "numeric" });
}

function formatLastActive(dateLocal: string | null): string | null {
  if (!dateLocal) return null;
  const [y, m, d] = dateLocal.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", year: "numeric" });
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
    created_at: string;
    pinned_project_id: string | null;
    pinned_activity_id: string | null;
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
    .select("id, username, avatar_url, bio, timezone, created_at, pinned_project_id, pinned_activity_id")
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
      category,
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

  // Activity rows for heatmap + per-project stats
  const supabase = createSupabaseAdmin();
  const { data: activityRows } = await supabase
    .from("activities")
    .select("date_local, project_id")
    .eq("user_id", user.id)
    .not("date_local", "is", null)
    .order("date_local", { ascending: false });

  const countMap = new Map<string, number>();
  const projectLastActiveMap = new Map<string, string>(); // project_id → max date_local (first seen = most recent)
  const projectActivityCountMap = new Map<string, number>();

  for (const row of activityRows ?? []) {
    const d = row.date_local as string;
    countMap.set(d, (countMap.get(d) ?? 0) + 1);
    if (row.project_id) {
      if (!projectLastActiveMap.has(row.project_id)) {
        projectLastActiveMap.set(row.project_id, d); // rows ordered DESC
      }
      projectActivityCountMap.set(
        row.project_id,
        (projectActivityCountMap.get(row.project_id) ?? 0) + 1
      );
    }
  }

  const activityData = [...countMap.entries()].map(([date, count]) => ({ date, count }));
  const totalPostCount = activityRows?.length ?? 0;

  // Pinned post — identify from feed
  const pinnedActivityId = user.pinned_activity_id;
  const pinnedFeedItem = pinnedActivityId
    ? (feed.find((item) => item.activity.id === pinnedActivityId) ?? null)
    : null;
  const feedWithoutPinned = pinnedFeedItem
    ? feed.filter((item) => item.activity.id !== pinnedActivityId)
    : feed;

  // Pinned project
  const pinnedProject = user.pinned_project_id
    ? (projects.find((p) => p.id === user.pinned_project_id) ?? null)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      {/* Hero: Avatar + Identity */}
      <header className="mb-6">
        <div className="flex items-start gap-5">
          {user?.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt=""
              width={104}
              height={104}
              className="rounded-full shrink-0"
            />
          ) : (
            <div className="flex h-26 w-26 shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-4xl font-medium text-[#78716c]">
              {(user?.username ?? "?")[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="font-(family-name:--font-fraunces) text-3xl font-semibold text-[#2a1f14]">
              {user?.username ?? username}
            </h1>
            <ProfileBioEditor bio={user.bio} isOwner={isOwner} />
            {/* Stats row */}
            <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-[#a8a29e]">
              <span className="font-medium text-[#78716c]">{projects.length}</span>
              <span>{projects.length === 1 ? "project" : "projects"}</span>
              <span className="mx-1">·</span>
              <span className="font-medium text-[#78716c]">{totalPostCount}</span>
              <span>{totalPostCount === 1 ? "post" : "posts"}</span>
              <span className="mx-1">·</span>
              <span>Joined {formatJoinDate(user.created_at)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Activity heatmap */}
      <section className="mb-8">
        <ConsistencyGrid activityData={activityData} timezone={user.timezone} />
      </section>

      {/* Featured project slot */}
      {pinnedProject && (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
            Featured
          </p>
          {isOwner ? (
            <OwnerFeaturedProject
              project={pinnedProject}
              username={username}
              postCount={projectActivityCountMap.get(pinnedProject.id) ?? 0}
              lastActive={formatLastActive(projectLastActiveMap.get(pinnedProject.id) ?? null)}
            />
          ) : (
            <FeaturedProjectCard
              project={pinnedProject}
              username={username}
              postCount={projectActivityCountMap.get(pinnedProject.id) ?? 0}
              lastActive={formatLastActive(projectLastActiveMap.get(pinnedProject.id) ?? null)}
            />
          )}
        </section>
      )}

      {/* Projects section */}
      {isOwner ? (
        <section className="mb-8">
          <ProjectManager
            username={username}
            initialPinnedProjectId={user.pinned_project_id}
          />
        </section>
      ) : projects.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-(family-name:--font-fraunces) text-xl font-semibold text-[#2a1f14]">
            Projects
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {projects.map((p) => {
              const displayUrl =
                p.url ?? (p.project_repos?.[0] as { repo_url?: string } | undefined)?.repo_url ?? null;
              const lastActive = formatLastActive(projectLastActiveMap.get(p.id) ?? null);
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
                    {lastActive && (
                      <p className="mt-2 text-xs text-[#a8a29e]">Last active {lastActive}</p>
                    )}
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

        {/* Pinned post */}
        {pinnedFeedItem && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
              Pinned
            </p>
            <div className={`overflow-hidden rounded-xl ${pinnedFeedItem.activity.type === "milestone" ? "border border-amber-300 shadow-[0_1px_3px_rgba(120,80,40,0.10)]" : "card"}`}>
              <div className="px-4">
                <ActivityItem
                  user={null}
                  project={pinnedFeedItem.project}
                  repo={pinnedFeedItem.repo}
                  activity={pinnedFeedItem.activity}
                  showUser={false}
                  projectHref={pinnedFeedItem.project?.id
                    ? `/u/${username}/projects/${pinnedFeedItem.project?.slug?.trim() ? pinnedFeedItem.project.slug : pinnedFeedItem.project?.id}`
                    : undefined}
                  heartCount={pinnedFeedItem.activity.hearts_count}
                  commentCount={pinnedFeedItem.activity.comments_count}
                  hearted={pinnedFeedItem.activity.hearted}
                  currentUserId={sessionUser?.userId ?? null}
                  postHref={pinnedFeedItem.activity.id ? `/p/${pinnedFeedItem.activity.id}` : undefined}
                  canDelete={isOwner}
                  canPin={isOwner}
                  pinnedActivityId={pinnedActivityId}
                />
              </div>
            </div>
          </div>
        )}

        <h2 className="mb-3 font-(family-name:--font-fraunces) text-xl font-semibold text-[#2a1f14]">
          Activity
        </h2>
        {feed.length === 0 ? (
          <p className="text-[#78716c]">No activity yet.</p>
        ) : (
          <>
            <div className="space-y-4">
              {groupFeedItems(feedWithoutPinned).map((group) => (
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
                          canPin={isOwner}
                          pinnedActivityId={pinnedActivityId}
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

function FeaturedProjectCard({
  project,
  username,
  postCount,
  lastActive,
}: {
  project: ProjectSummary;
  username: string;
  postCount: number;
  lastActive: string | null;
}) {
  const projectHref = `/u/${username}/projects/${project.slug?.trim() ? project.slug : project.id}`;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Level {project.level}
            </span>
            <Link
              href={projectHref}
              className="font-(family-name:--font-fraunces) text-xl font-semibold text-[#2a1f14] hover:text-[#b5522a]"
            >
              {project.title}
            </Link>
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-[#78716c]">{project.description}</p>
          )}
          {project.project_repos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.project_repos.map((repo) => {
                const Wrapper = repo.repo_url ? "a" : "span";
                const wrapperProps = repo.repo_url
                  ? { href: repo.repo_url, target: "_blank", rel: "noopener noreferrer" }
                  : {};
                return (
                  <Wrapper
                    key={repo.id}
                    {...wrapperProps}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs text-[#78716c] shadow-sm hover:text-[#b5522a] hover:underline"
                  >
                    <FeaturedSourceBadge type={repo.connector_type} />
                    {repo.repo_full_name}
                  </Wrapper>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-[#a8a29e]">
            {postCount} {postCount === 1 ? "post" : "posts"}
            {lastActive && <> · last active {lastActive}</>}
          </p>
        </div>
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-[#a8a29e] hover:bg-amber-100 hover:text-[#b5522a]"
            aria-label="Open project website"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
      <div className="mt-4 overflow-hidden rounded-full bg-amber-100" style={{ height: "4px" }}>
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ width: `${levelProgressPct(project.xp, project.level)}%` }}
        />
      </div>
    </div>
  );
}

function FeaturedSourceBadge({ type }: { type?: string }) {
  if (type === "github") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#24292e] text-[7px] font-bold text-white">
        GH
      </span>
    );
  }
  if (type === "medium") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-black text-[7px] font-bold text-white">
        M
      </span>
    );
  }
  return null;
}
