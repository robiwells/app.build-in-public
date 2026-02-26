import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { CommentForm } from "@/components/CommentForm";
import { DeleteCommentButton } from "@/components/DeleteCommentButton";
import { ProjectTabs } from "@/components/ProjectTabs";
import { levelProgressPct, xpInCurrentLevel, xpToNextLevel } from "@/lib/xp";

export const revalidate = 30;

type ProjectRepo = {
  id: string;
  repo_full_name: string;
  repo_url: string;
};

type ProjectComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  user: { id: string; username: string; avatar_url: string | null } | null;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  slug: string | null;
  xp: number;
  level: number;
  comments_count: number;
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
  comments: ProjectComment[];
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
  const { data: rawProject } = await supabase
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
      comments_count,
      project_connector_sources!left(id, external_id, url, active, connector_type)
    `
    )
    .eq("user_id", user.id)
    .eq(byId ? "id" : "slug", slugOrId)
    .eq("active", true)
    .eq("project_connector_sources.connector_type", "github")
    .eq("project_connector_sources.active", true)
    .maybeSingle();

  // Remap to backward-compatible shape
  const project = rawProject
    ? (() => {
        const { project_connector_sources: sources, ...rest } = rawProject as Record<string, unknown>;
        return {
          ...rest,
          project_repos: ((sources as Array<Record<string, unknown>>) ?? []).map((s) => ({
            id: s.id,
            repo_full_name: s.external_id,
            repo_url: s.url,
            active: s.active,
          })),
        } as unknown as typeof rawProject;
      })()
    : null;

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
      project_connector_sources(external_id, url)
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
    const connectorSource = row.project_connector_sources as Record<string, unknown> | null;
    return {
      repo: connectorSource
        ? {
            repo_full_name: connectorSource.external_id as string,
            repo_url: connectorSource.url as string,
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

  const { data: commentRows } = await supabase
    .from("project_comments")
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const comments: ProjectComment[] = (commentRows ?? []).map((c: Record<string, unknown>) => {
    const cu = c.users as Record<string, unknown> | null;
    return {
      id: c.id as string,
      body: c.body as string,
      created_at: c.created_at as string,
      user_id: c.user_id as string,
      user: cu
        ? { id: cu.id as string, username: cu.username as string, avatar_url: cu.avatar_url as string | null }
        : null,
    };
  });

  return {
    user,
    project: {
      ...project,
      slug: project.slug ?? null,
      xp: (project as unknown as { xp?: number }).xp ?? 0,
      level: (project as unknown as { level?: number }).level ?? 1,
      comments_count: (project as unknown as { comments_count?: number }).comments_count ?? 0,
    } as unknown as Project,
    feed,
    nextCursor,
    comments,
  };
}

function formatRelative(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

/** Path segment for project URL: slug if set, else id (backward compatible). */
function projectSegment(p: { slug?: string | null; id: string }): string {
  return p.slug?.trim() ? p.slug : p.id;
}

function groupByDate(items: FeedItem[]): { key: string; date: string; items: FeedItem[] }[] {
  const map = new Map<string, { date: string; items: FeedItem[] }>();
  for (const item of items) {
    const date = item.activity.date_utc ?? "";
    const key = item.activity.type === "milestone"
      ? `milestone_${item.activity.id}`
      : date;
    if (!map.has(key)) map.set(key, { date, items: [] });
    map.get(key)!.items.push(item);
  }
  return [...map.entries()].map(([key, { date, items }]) => ({ key, date, items }));
}

function formatDate(dateUtc: string): string {
  const [y, m, d] = dateUtc.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; projectId: string }>;
  searchParams: Promise<{ cursor?: string; tab?: string }>;
}) {
  const { username, projectId: slugOrId } = await params;
  const { cursor, tab } = await searchParams;
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const data = await getProjectData(username, slugOrId, cursor);

  if (!data) notFound();

  const { user, project, feed, nextCursor, comments } = data;
  const isOwner = sessionUser?.userId === user.id;
  const sessionUserId = sessionUser?.userId ?? null;
  const initialTab = tab === "discussion" ? "discussion" : "activity";

  const activityContent = (
    <section className="mt-8">
      {feed.length === 0 ? (
        <p className="text-[#78716c]">No activity yet.</p>
      ) : (
        <>
          <div className="space-y-4">
            {groupByDate(feed).map(({ key, date, items }) => (
              <div
                key={key}
                className={`overflow-hidden rounded-xl bg-white ${
                  items.some(i => i.activity.type === "milestone")
                    ? "border border-amber-300 shadow-[0_1px_3px_rgba(120,80,40,0.10)]"
                    : "card"
                }`}
              >
                <div className="flex items-center border-b border-[#e8ddd0] bg-[#f5f0e8] px-4 py-2.5">
                  <span className="text-sm font-medium text-[#2a1f14]">{formatDate(date)}</span>
                </div>
                <div className="px-4">
                  {items.map((item) => (
                    <ActivityItem
                      key={item.activity.id ?? item.activity.date_utc}
                      user={null}
                      project={{ title: project.title }}
                      repo={item.repo}
                      activity={item.activity}
                      showUser={false}
                      showProject={false}
                      hideHeader={true}
                      canDelete={isOwner}
                    />
                  ))}
                </div>
              </div>
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
  );

  const discussionContent = (
    <section className="mt-8">
      {comments.length === 0 ? (
        <p className="text-sm text-[#a8a29e]">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {comment.user?.avatar_url ? (
                <Link href={`/u/${comment.user.username}`} className="shrink-0">
                  <Image
                    src={comment.user.avatar_url}
                    alt={comment.user.username}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                </Link>
              ) : comment.user ? (
                <Link
                  href={`/u/${comment.user.username}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-xs font-medium text-[#78716c]"
                >
                  {comment.user.username[0].toUpperCase()}
                </Link>
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[#f5f0e8]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  {comment.user && (
                    <Link href={`/u/${comment.user.username}`} className="text-sm font-medium text-[#2a1f14] hover:text-[#b5522a]">
                      {comment.user.username}
                    </Link>
                  )}
                  <span className="text-xs text-[#a8a29e]">{formatRelative(comment.created_at)}</span>
                  {sessionUserId && comment.user_id === sessionUserId && (
                    <DeleteCommentButton
                      commentId={comment.id}
                      apiPath={`/api/project-comments/${comment.id}`}
                    />
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#2a1f14]">
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-[#e8ddd0] pt-4">
        {sessionUserId ? (
          <CommentForm
            postId={project.id}
            apiPath={`/api/projects/${project.id}/comments`}
          />
        ) : (
          <p className="text-sm text-[#78716c]">
            <Link
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/u/${user.username}/projects/${projectSegment(project)}?tab=discussion`)}`}
              className="font-medium text-[#b5522a] hover:underline"
            >
              Sign in
            </Link>{" "}
            to leave a comment.
          </p>
        )}
      </div>
    </section>
  );

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Link
        href={`/u/${user.username}`}
        className="text-sm font-medium text-[#78716c] hover:text-[#b5522a]"
      >
        ← {user.username}
      </Link>

      <header className="mt-6 mb-0 pb-8 border-b border-[#e8ddd0]">
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
            {project.title}
          </h1>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
            Level {project.level}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e8ddd0]">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${levelProgressPct(project.xp, project.level)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-[#a8a29e]">
            {xpInCurrentLevel(project.xp, project.level)}/{xpToNextLevel(project.level)} XP
          </span>
        </div>
        {project.description && (
          <p className="mt-4 text-sm text-[#78716c]">
            {project.description}
          </p>
        )}
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-[#b5522a] hover:underline"
          >
            {project.url}
          </a>
        )}
        {project.project_repos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
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

      <ProjectTabs
        commentsCount={project.comments_count}
        initialTab={initialTab}
        activityContent={activityContent}
        discussionContent={discussionContent}
      />
    </main>
  );
}
