import Link from "next/link";
import { headers } from "next/headers";
import { ActivityItem } from "@/components/ActivityItem";

async function getFeed(cursor?: string) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const base = `${protocol}://${host}`;
  const url = new URL("/api/feed", base);
  url.searchParams.set("limit", "20");
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) return { feed: [] as FeedItem[], nextCursor: null as string | null };
  const data = (await res.json()) as { feed?: FeedItem[]; nextCursor?: string | null };
  return { feed: data.feed ?? [], nextCursor: data.nextCursor ?? null };
}

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
