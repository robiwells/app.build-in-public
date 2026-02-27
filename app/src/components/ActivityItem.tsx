import Image from "next/image";
import Link from "next/link";
import { HeartButton } from "@/components/HeartButton";
import { PostMenu } from "@/components/PostMenu";
import { ExpandableCommitList } from "@/components/ExpandableCommitList";

type ActivityItemProps = {
  user?: { username?: string; avatar_url?: string | null } | null;
  project?: { title?: string } | null;
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
    connector_metadata?: Record<string, unknown> | null;
  };
  showUser?: boolean;
  showProject?: boolean;
  projectHref?: string;
  heartCount?: number;
  commentCount?: number;
  hearted?: boolean;
  currentUserId?: string | null;
  postHref?: string;
  /** Show 3-dot menu with delete when true (only for post owner). */
  canDelete?: boolean;
  /** After delete, navigate here (e.g. on post detail page). Otherwise refresh. */
  deleteRedirectHref?: string;
  /** Suppress the date heading even when dateAsHeader would be true. */
  hideHeader?: boolean;
  /** Show pin/unpin option in the 3-dot menu (only for post owner). */
  canPin?: boolean;
  /** The currently pinned activity ID for this user's profile. */
  pinnedActivityId?: string | null;
};

function formatDate(dateUtc: string | undefined): string {
  if (!dateUtc) return "";
  const [y, m, d] = dateUtc.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", day: "numeric" });
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

function formatTimeRange(
  first: string | null | undefined,
  last: string | null | undefined
): string {
  if (!first || !last) return "";
  const fmt = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const t1 = fmt(first);
  const t2 = fmt(last);
  return t1 === t2 ? t1 : `${t1} – ${t2}`;
}

export function ActivityItem({
  user,
  project,
  repo,
  activity,
  showUser = true,
  showProject = true,
  projectHref,
  heartCount,
  commentCount,
  hearted,
  currentUserId,
  postHref,
  canDelete,
  deleteRedirectHref,
  hideHeader,
  canPin,
  pinnedActivityId,
}: ActivityItemProps) {
  const isManual = activity.type === "manual";
  const isMilestone = activity.type === "milestone";
  const isMedium = activity.type === "auto_medium";
  const dateAsHeader = !showUser && !showProject;
  const count = activity.commit_count ?? 0;
  const repoName = repo?.repo_full_name ?? "repo";
  const repoUrl = repo?.repo_url ?? "#";
  const projectTitle = project?.title;
  const timeRange = formatTimeRange(activity.first_commit_at, activity.last_commit_at);
  const messages = activity.commit_messages ?? [];
  const showMenu = (canDelete || canPin) && activity.id;
  const showHeaderRow =
    (showUser && !!user) ||
    (showProject && !!projectTitle) ||
    (dateAsHeader && !hideHeader);

  return (
    <article className={`border-b py-4 last:border-0 ${isMilestone ? "border-amber-300" : isMedium ? "border-emerald-100" : "border-[#e8ddd0]"}`}>
      <div className="flex items-start gap-3">
        {showUser && user?.avatar_url && (
          <Link href={`/u/${user.username}`} className="shrink-0">
            <Image
              src={user.avatar_url}
              alt={user.username ?? ""}
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>
        )}
        {showUser && user && !user.avatar_url && (
          <Link
            href={`/u/${user.username}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-sm font-medium text-[#78716c]"
          >
            {(user.username ?? "?")[0].toUpperCase()}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {showHeaderRow && (
            <p className="min-w-0 text-[#2a1f14]">
              {showUser && user && (
                <>
                  <Link href={`/u/${user.username}`} className="font-medium hover:text-[#b5522a]">
                    {user.username}
                  </Link>
                  {" · "}
                </>
              )}
              {showProject && (projectTitle ? (
                projectHref ? (
                  <Link href={projectHref} className="font-medium hover:text-[#b5522a]">
                    {projectTitle}
                  </Link>
                ) : (
                  <span className="font-medium">{projectTitle}</span>
                )
              ) : !isManual ? (
                <span className="font-medium">{repoName}</span>
              ) : null)}
              {dateAsHeader && !hideHeader && (
                <span className="font-medium">{formatDate(activity.date_utc)}</span>
              )}
            </p>
          )}

          {isMilestone ? (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-base">🚀</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Milestone</span>
              </div>
              {activity.content_text && (
                <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-[#2a1f14]">
                  {activity.content_text}
                </p>
              )}
              {activity.content_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activity.content_image_url}
                  alt=""
                  className="mt-2 max-w-sm rounded-lg"
                />
              )}
              <p className="mt-1 text-sm text-[#a8a29e]">
                {!dateAsHeader && formatDate(activity.date_utc)}
                {activity.last_commit_at && <>{!dateAsHeader && " · "}{formatRelative(activity.last_commit_at)}</>}
              </p>
            </>
          ) : isMedium ? (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-emerald-600">
                  <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Medium</span>
              </div>
              {activity.connector_metadata?.title && (
                <p className="mt-1 font-semibold text-[#2a1f14]">
                  {activity.connector_metadata.article_url ? (
                    <a
                      href={activity.connector_metadata.article_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#b5522a] hover:underline"
                    >
                      {activity.connector_metadata.title as string}
                    </a>
                  ) : (
                    activity.connector_metadata.title as string
                  )}
                </p>
              )}
              {activity.content_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activity.content_image_url}
                  alt=""
                  className="mt-2 max-h-48 max-w-sm rounded-lg object-cover"
                />
              )}
              {activity.content_text && (
                <p className="mt-1 line-clamp-3 text-sm text-[#78716c]">
                  {activity.content_text}
                </p>
              )}
              <p className="mt-1 text-sm text-[#a8a29e]">
                {!dateAsHeader && formatDate(activity.date_utc)}
                {activity.last_commit_at && <>{!dateAsHeader && " · "}{formatRelative(activity.last_commit_at)}</>}
                {repo?.repo_full_name && (
                  <> · via <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-[#b5522a] hover:underline">{repo.repo_full_name}</a></>
                )}
              </p>
              {activity.connector_metadata?.article_url && (
                <div className="mt-2">
                  <a
                    href={activity.connector_metadata.article_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Read on Medium →
                  </a>
                </div>
              )}
            </>
          ) : isManual ? (
            <>
              {activity.content_text && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#2a1f14]">
                  {activity.content_text}
                </p>
              )}
              {activity.content_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activity.content_image_url}
                  alt=""
                  className="mt-2 max-w-sm rounded-lg"
                />
              )}
              <p className="mt-1 text-sm text-[#a8a29e]">
                {!dateAsHeader && formatDate(activity.date_utc)}
                {activity.last_commit_at && <>{!dateAsHeader && " · "}{formatRelative(activity.last_commit_at)}</>}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#a8a29e]">
                {count} commit{count !== 1 ? "s" : ""}
                {repo?.repo_full_name && (
                  <> to{" "}
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-[#b5522a] hover:underline">
                      {repo.repo_full_name}
                    </a>
                  </>
                )}
                {!dateAsHeader && <> · {formatDate(activity.date_utc)}</>}
                {timeRange && <> · {timeRange}</>}
                {activity.last_commit_at && <> · {formatRelative(activity.last_commit_at)}</>}
                {activity.github_link && (
                  <> · <a href={activity.github_link} target="_blank" rel="noopener noreferrer" className="text-[#b5522a] hover:underline">View on GitHub</a></>
                )}
              </p>
              {messages.length > 0 && (
                <ExpandableCommitList messages={messages} className="mt-2" />
              )}
            </>
          )}
          {postHref && activity.id && (
            <div className="mt-2 flex items-center gap-4 text-sm text-[#a8a29e]">
              <HeartButton
                postId={activity.id}
                initialCount={heartCount ?? 0}
                initialHearted={hearted ?? false}
                currentUserId={currentUserId ?? null}
              />
              <Link href={postHref} className="hover:text-[#b5522a]">
                {commentCount ?? 0} comment{commentCount !== 1 ? "s" : ""}
              </Link>
            </div>
          )}
        </div>
        {showMenu && (
          <PostMenu
            postId={activity.id!}
            redirectHref={deleteRedirectHref}
            canPin={canPin}
            isPinned={!!pinnedActivityId && pinnedActivityId === activity.id}
          />
        )}
      </div>
    </article>
  );
}
