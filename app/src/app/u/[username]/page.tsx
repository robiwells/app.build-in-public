import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { ProjectManager } from "@/components/ProjectManager";
import { ProfileBioEditor } from "@/components/ProfileBioEditor";

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
  project?: { title?: string } | null;
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

async function getUserData(
  username: string,
  cursor?: string
): Promise<{
  user: { id: string; username: string; avatar_url: string | null; bio: string | null };
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
    .select("id, username, avatar_url, bio")
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
      commit_count,
      first_commit_at,
      last_commit_at,
      github_link,
      commit_messages,
      project_id,
      project_repo_id,
      projects!inner(id, title, active),
      project_repos(repo_full_name, repo_url)
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
      project: proj ? { title: proj.title as string } : null,
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

  return {
    user,
    projects: (projects as ProjectSummary[]) ?? [],
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
  const data = await getUserData(username, cursor);

  if (!data) notFound();

  const { user, projects, feed, nextCursor } = data;

  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const isOwner = sessionUser?.userId === user.id;

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

      {/* Projects section */}
      {isOwner ? (
        <section className="mb-8">
          <ProjectManager />
        </section>
      ) : projects.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Projects
          </h2>
          <div className="space-y-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {p.title}
                </h3>
                {p.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {p.description}
                  </p>
                )}
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    {p.url}
                  </a>
                )}
                {p.project_repos.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {p.project_repos.map((repo) => (
                      <a
                        key={repo.id}
                        href={repo.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:underline dark:bg-zinc-800/50 dark:text-zinc-300"
                      >
                        {repo.repo_full_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Activity feed */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Activity
        </h2>
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
                  repo={item.repo}
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
      </section>
    </main>
  );
}
