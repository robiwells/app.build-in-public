import Image from "next/image";
import Link from "next/link";
import { HeartButton } from "@/components/HeartButton";

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
  };
  showUser?: boolean;
  showProject?: boolean;
  projectHref?: string;
  heartCount?: number;
  commentCount?: number;
  hearted?: boolean;
  currentUserId?: string | null;
  postHref?: string;
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
}: ActivityItemProps) {
  const isManual = activity.type === "manual";
  const isMilestone = activity.type === "milestone";
  const count = activity.commit_count ?? 0;
  const repoName = repo?.repo_full_name ?? "repo";
  const repoUrl = repo?.repo_url ?? "#";
  const projectTitle = project?.title;
  const timeRange = formatTimeRange(activity.first_commit_at, activity.last_commit_at);
  const messages = activity.commit_messages ?? [];

  return (
    <article className={`border-b py-4 last:border-0 ${isMilestone ? "border-amber-200 dark:border-amber-900" : "border-zinc-200 dark:border-zinc-800"}`}>
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          >
            {(user.username ?? "?")[0].toUpperCase()}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-zinc-900 dark:text-zinc-100">
            {showUser && user && (
              <>
                <Link href={`/u/${user.username}`} className="font-medium hover:underline">
                  {user.username}
                </Link>
                {" · "}
              </>
            )}
            {showProject && (projectTitle ? (
              projectHref ? (
                <Link href={projectHref} className="font-medium hover:underline">
                  {projectTitle}
                </Link>
              ) : (
                <span className="font-medium">{projectTitle}</span>
              )
            ) : !isManual ? (
              <span className="font-medium">{repoName}</span>
            ) : null)}
          </p>

          {isMilestone ? (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-base">🚀</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Milestone</span>
              </div>
              {activity.content_text && (
                <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(activity.date_utc)}
                {activity.last_commit_at && <> · {formatRelative(activity.last_commit_at)}</>}
              </p>
            </>
          ) : isManual ? (
            <>
              {activity.content_text && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
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
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(activity.date_utc)}
                {activity.last_commit_at && <> · {formatRelative(activity.last_commit_at)}</>}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {count} commit{count !== 1 ? "s" : ""}
                {repo?.repo_full_name && (
                  <> to{" "}
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {repo.repo_full_name}
                    </a>
                  </>
                )}
                {" · "}
                {formatDate(activity.date_utc)}
                {timeRange && <> · {timeRange}</>}
                {activity.last_commit_at && <> · {formatRelative(activity.last_commit_at)}</>}
                {activity.github_link && (
                  <> · <a href={activity.github_link} target="_blank" rel="noopener noreferrer" className="hover:underline">View on GitHub</a></>
                )}
              </p>
              {messages.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {messages.slice(0, 3).map((msg, i) => (
                    <li key={i} className="truncate">· {msg}</li>
                  ))}
                  {messages.length > 3 && (
                    <li className="text-zinc-400 dark:text-zinc-500">+ {messages.length - 3} more</li>
                  )}
                </ul>
              )}
            </>
          )}
          {postHref && activity.id && (
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500">
              <HeartButton
                postId={activity.id}
                initialCount={heartCount ?? 0}
                initialHearted={hearted ?? false}
                currentUserId={currentUserId ?? null}
              />
              <Link href={postHref} className="hover:underline">
                {commentCount ?? 0} comment{commentCount !== 1 ? "s" : ""}
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
