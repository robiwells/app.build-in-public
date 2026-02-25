import Link from "next/link";
import Image from "next/image";
import { ActivityItem } from "@/components/ActivityItem";
import { Composer } from "@/components/Composer";
import { FeedRefresh } from "@/components/FeedRefresh";
import { CategoryFilter } from "@/components/CategoryFilter";
import { auth } from "@/lib/auth";
import { queryFeed } from "@/lib/feed";
import type { FeedItem } from "@/lib/types";
import { createSupabaseAdmin } from "@/lib/supabase";

export const revalidate = 30;

type HomeFeedGroup = {
  key: string;
  user: { username: string; avatar_url: string | null } | null;
  project: { title?: string; id?: string; slug?: string | null } | null;
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
    const key = item.activity.type === "milestone"
      ? `milestone_${item.activity.id}`
      : `${username}_${projectId}_${date}`;

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
  searchParams: Promise<{ cursor?: string; category?: string }>;
}) {
  const { cursor, category } = await searchParams;
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const { feed, nextCursor } = await queryFeed({
    cursor,
    category,
    sessionUserId: sessionUser?.userId,
  });

  const sessionUserData = sessionUser?.userId
    ? await getSessionUserData(sessionUser.userId)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <FeedRefresh />

      {sessionUser?.userId && sessionUserData && (
        <Composer
          userId={sessionUser.userId}
          projects={sessionUserData.projects}
          timezone={sessionUserData.timezone}
        />
      )}

      <CategoryFilter selectedCategory={category} />

      {feed.length === 0 ? (
        <p className="text-[#78716c]">
          It&apos;s quiet... too quiet.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {groupHomeFeed(feed).map((group) => {
              const profileHref = group.user?.username ? `/u/${group.user.username}` : undefined;
                  const groupProjectHref =
                    group.user?.username && group.project?.id
                      ? `/u/${group.user.username}/projects/${group.project.slug?.trim() ? group.project.slug : group.project.id}`
                      : undefined;
              return (
                <div key={group.key} className={`feed-item overflow-hidden rounded-xl bg-white ${group.items.some(i => i.activity.type === "milestone") ? "border border-amber-300 shadow-[0_1px_3px_rgba(120,80,40,0.10)]" : "card"}`}>
                  {/* Group header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#e8ddd0] bg-[#f5f0e8] px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {group.user?.avatar_url ? (
                        <Image
                          src={group.user.avatar_url}
                          alt={group.user.username}
                          width={24}
                          height={24}
                          className="shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8ddd0] text-xs font-medium text-[#78716c]">
                          {(group.user?.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      {profileHref ? (
                        <Link href={profileHref} className="truncate text-sm font-medium text-[#2a1f14] hover:text-[#b5522a]">
                          {group.user?.username}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-medium text-[#2a1f14]">{group.user?.username}</span>
                      )}
                      {group.project?.title && (
                        <>
                          <span className="text-sm text-[#a8a29e]">·</span>
                          {groupProjectHref ? (
                            <Link href={groupProjectHref} className="truncate text-sm text-[#78716c] hover:text-[#b5522a]">
                              {group.project.title}
                            </Link>
                          ) : (
                            <span className="truncate text-sm text-[#78716c]">{group.project.title}</span>
                          )}
                        </>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[#a8a29e]">{formatGroupDate(group.date)}</span>
                  </div>
                  {/* Items */}
                  <div className="px-4">
                    {group.items.map((item) => {
                      const projectHref =
                        item.user?.username && item.project?.id
                          ? `/u/${item.user.username}/projects/${item.project.slug?.trim() ? item.project.slug : item.project.id}`
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
                          showProject={false}
                          hideHeader={true}
                          projectHref={projectHref}
                          heartCount={item.activity.hearts_count}
                          commentCount={item.activity.comments_count}
                          hearted={item.activity.hearted}
                          currentUserId={sessionUser?.userId ?? null}
                          postHref={postHref}
                          canDelete={!!(item.activity.id && sessionUser?.userId && item.activity.user_id === sessionUser.userId)}
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
                href={`/?cursor=${encodeURIComponent(nextCursor)}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                className="text-sm font-medium text-[#78716c] hover:text-[#b5522a]"
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
