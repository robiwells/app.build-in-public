import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { levelProgressPct, xpInCurrentLevel, xpToNextLevel } from "@/lib/xp";

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
  xp: number;
  level: number;
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
      xp,
      level,
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
    project: {
      ...project,
      slug: project.slug ?? null,
      xp: (project as unknown as { xp?: number }).xp ?? 0,
      level: (project as unknown as { level?: number }).level ?? 1,
    } as Project,
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
        className="text-sm font-medium text-[#78716c] hover:text-[#b5522a]"
      >
        ← {user.username}
      </Link>

      <header className="my-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
          {project.title}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
            Level {project.level}
          </span>
          <div className="flex w-48 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8ddd0]">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${levelProgressPct(project.xp, project.level)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-[#a8a29e]">
              {xpInCurrentLevel(project.xp, project.level)}/{xpToNextLevel(project.level)} XP
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#a8a29e]">{project.xp} XP total</p>
        {project.description && (
          <p className="mt-3 text-sm text-[#78716c]">
            {project.description}
          </p>
        )}
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-[#b5522a] hover:underline"
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
                className="rounded-full bg-[#f5f0e8] px-3 py-1 text-sm text-[#78716c] hover:underline"
              >
                {r.repo_full_name}
              </a>
            ))}
          </div>
        )}
      </header>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14]">
          Activity
        </h2>
        {feed.length === 0 ? (
          <p className="text-[#78716c]">No activity yet.</p>
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
