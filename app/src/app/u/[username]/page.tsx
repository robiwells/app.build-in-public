import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityItem } from "@/components/ActivityItem";

async function getUserFeed(username: string, cursor?: string) {
  const base = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";
  const url = new URL(`/api/feed/u/${encodeURIComponent(username)}`, base);
  url.searchParams.set("limit", "20");
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<{
    user?: { username?: string; avatar_url?: string | null };
    feed?: Array<{
      project?: { repo_full_name?: string; repo_url?: string } | null;
      activity: {
        id?: string;
        date_utc?: string;
        commit_count?: number;
        last_commit_at?: string | null;
        github_link?: string | null;
      };
    }>;
    nextCursor?: string | null;
  }>;
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

  const { user, feed = [], nextCursor } = data;

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
