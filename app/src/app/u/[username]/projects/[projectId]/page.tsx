import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";

export const revalidate = 30;

type ProjectRepo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  slug: string | null;
  project_repos: ProjectRepo[];
};

type FeedItem = {
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getProjectData(
  username: string,
  slugOrId: string,
  cursor?: string
): Promise<{
  user: { id: string; username: string; avatar_url: string | null };
  project: Project;
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

  const byId = UUID_REGEX.test(slugOrId);
  const { data: project } = await supabase
    .from("projects")
    .select(
      `
      id,
      title,
      description,
      url,
      slug,
      project_repos!left(id, repo_full_name, repo_url, active)
    `
    )
    .eq("user_id", user.id)
    .eq(byId ? "id" : "slug", slugOrId)
    .eq("active", true)
    .eq("project_repos.active", true)
    .maybeSingle();

  if (!project) return null;

  const projectId = project.id;

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
      project_repos(repo_full_name, repo_url)
    `
    )
    .eq("project_id", projectId)
    .order("last_commit_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("last_commit_at", cursor);
  }

  const { data: rows } = await query;

  const safeRows = rows ?? [];
  const hasMore = safeRows.length > limit;
  const items = hasMore ? safeRows.slice(0, limit) : safeRows;
  const nextCursor =
    hasMore && items.length > 0
      ? (items[items.length - 1] as { last_commit_at?: string | null }).last_commit_at ?? null
      : null;

  const feed = items.map((row: Record<string, unknown>) => {
    const projectRepos = row.project_repos as Record<string, unknown> | null;
    return {
      repo: projectRepos
        ? {
            repo_full_name: projectRepos.repo_full_name as string,
            repo_url: projectRepos.repo_url as string,
          }
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
    project: { ...project, slug: project.slug ?? null } as Project,
    feed,
    nextCursor,
  };
}

/** Path segment for project URL: slug if set, else id (backward compatible). */
function projectSegment(p: { slug?: string | null; id: string }): string {
  return p.slug?.trim() ? p.slug : p.id;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; projectId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { username, projectId: slugOrId } = await params;
  const { cursor } = await searchParams;
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const data = await getProjectData(username, slugOrId, cursor);

  if (!data) notFound();

  const { user, project, feed, nextCursor } = data;
  const isOwner = sessionUser?.userId === user.id;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Link
        href={`/u/${user.username}`}
        className="text-sm font-medium text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← {user.username}
      </Link>

      <header className="my-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {project.title}
        </h1>
        {project.description && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {project.description}
          </p>
        )}
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            {project.url}
          </a>
        )}
        {project.project_repos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.project_repos.map((r) => (
              <a
                key={r.id}
                href={r.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:underline dark:bg-zinc-800 dark:text-zinc-300"
              >
                {r.repo_full_name}
              </a>
            ))}
          </div>
        )}
      </header>

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
                  project={{ title: project.title }}
                  repo={item.repo}
                  activity={item.activity}
                  showUser={false}
                  canDelete={isOwner}
                />
              ))}
            </div>
            {nextCursor && (
              <div className="mt-6">
                <Link
                  href={`/u/${username}/projects/${projectSegment(project)}?cursor=${encodeURIComponent(nextCursor)}`}
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
