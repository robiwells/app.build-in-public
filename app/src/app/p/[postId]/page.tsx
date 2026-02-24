import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { ActivityItem } from "@/components/ActivityItem";
import { HeartButton } from "@/components/HeartButton";
import { CommentForm } from "@/components/CommentForm";
import { DeleteCommentButton } from "@/components/DeleteCommentButton";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  user: { id: string; username: string; avatar_url: string | null } | null;
};

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

function formatHeartsList(users: { username: string }[]): string {
  if (users.length === 0) return "";
  if (users.length === 1) return users[0].username;
  if (users.length === 2) return `${users[0].username} and ${users[1].username}`;
  const shown = users.slice(0, 2).map((u) => u.username).join(", ");
  const rest = users.length - 2;
  return `${shown} and ${rest} other${rest !== 1 ? "s" : ""}`;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const session = await auth();
  const sessionUser = session?.user as { userId?: string } | undefined;
  const sessionUserId = sessionUser?.userId ?? null;

  const supabase = createSupabaseAdmin();

  // Fetch activity with joins
  const { data: row, error } = await supabase
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
      hearts_count,
      comments_count,
      user_id,
      project_id,
      project_repo_id,
      users(id, username, avatar_url),
      projects(id, title, slug, category),
      project_repos(repo_full_name, repo_url)
    `
    )
    .eq("id", postId)
    .maybeSingle();

  if (error || !row) notFound();

  const r = row as Record<string, unknown>;
  const u = r.users as Record<string, unknown> | null;
  const p = r.projects as Record<string, unknown> | null;
  const repo = r.project_repos as Record<string, unknown> | null;

  const user = u ? { id: u.id as string, username: u.username as string, avatar_url: u.avatar_url as string | null } : null;
  const project = p ? { id: p.id as string, title: p.title as string, slug: p.slug as string | null, category: p.category as string | null } : null;
  const repoData = repo ? { repo_full_name: repo.repo_full_name as string, repo_url: repo.repo_url as string } : null;

  // Fetch hearts
  const { data: heartRows } = await supabase
    .from("hearts")
    .select("user_id, users(id, username, avatar_url)")
    .eq("post_id", postId);

  const heartUsers = (heartRows ?? []).map((h: Record<string, unknown>) => {
    const hu = h.users as Record<string, unknown> | null;
    return hu ? { id: hu.id as string, username: hu.username as string, avatar_url: hu.avatar_url as string | null } : null;
  }).filter((x): x is { id: string; username: string; avatar_url: string | null } => x !== null);

  const hearted = sessionUserId
    ? (heartRows ?? []).some((h: Record<string, unknown>) => h.user_id === sessionUserId)
    : false;

  // Fetch comments
  const { data: commentRows } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id, users(id, username, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const comments: Comment[] = (commentRows ?? []).map((c: Record<string, unknown>) => {
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

  const activity = {
    id: r.id as string,
    date_utc: r.date_utc as string,
    type: r.type as string,
    content_text: r.content_text as string | null,
    content_image_url: r.content_image_url as string | null,
    commit_count: r.commit_count as number,
    first_commit_at: r.first_commit_at as string | null,
    last_commit_at: r.last_commit_at as string | null,
    github_link: r.github_link as string | null,
    commit_messages: r.commit_messages as string[] | null,
  };

  const heartCount = r.hearts_count as number;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link href="/" className="text-sm text-[#78716c] hover:text-[#b5522a]">
          ← Back to feed
        </Link>
      </div>

      {/* Post card */}
      <div className="card overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#e8ddd0] bg-[#f5f0e8] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {user?.avatar_url ? (
              <Link href={`/u/${user.username}`} className="shrink-0">
                <Image
                  src={user.avatar_url}
                  alt={user.username}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              </Link>
            ) : user ? (
              <Link
                href={`/u/${user.username}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-xs font-medium text-[#78716c]"
              >
                {(user.username)[0].toUpperCase()}
              </Link>
            ) : null}
            {user && (
              <Link href={`/u/${user.username}`} className="truncate text-sm font-medium text-[#2a1f14] hover:text-[#b5522a]">
                {user.username}
              </Link>
            )}
            {project && (
              <>
                <span className="text-sm text-[#a8a29e]">·</span>
                <Link
                  href={user && project ? `/u/${user.username}/projects/${project.slug?.trim() ? project.slug : project.id}` : "#"}
                  className="truncate text-sm text-[#78716c] hover:text-[#b5522a]"
                >
                  {project.title}
                </Link>
                {project.category && (
                  <span className="rounded-full border border-[#e8ddd0] px-2 py-0.5 text-xs text-[#78716c]">
                    {project.category}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Activity content */}
        <div className="px-4">
          <ActivityItem
            user={null}
            project={project}
            repo={repoData}
            activity={activity}
            showUser={false}
            showProject={false}
            canDelete={sessionUserId === (r.user_id as string)}
            deleteRedirectHref={user ? `/u/${user.username}` : "/"}
          />
        </div>

        {/* Hearts + comment count */}
        <div className="flex items-center gap-4 px-4 pb-4">
          <HeartButton
            postId={postId}
            initialCount={heartCount}
            initialHearted={hearted}
            currentUserId={sessionUserId}
          />
          <span className="text-sm text-[#a8a29e]">
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Hearts list */}
        {heartUsers.length > 0 && (
          <div className="px-4 pb-3 text-xs text-[#a8a29e]">
            Liked by <span className="font-medium text-[#78716c]">{formatHeartsList(heartUsers)}</span>
          </div>
        )}
      </div>

      {/* Comments */}
      <section className="mt-6">
        <h2 className="mb-4 font-[family-name:var(--font-fraunces)] text-base font-semibold text-[#2a1f14]">
          Comments
        </h2>

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
                      <DeleteCommentButton commentId={comment.id} />
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

        {/* Comment form */}
        <div className="mt-6 border-t border-[#e8ddd0] pt-4">
          {sessionUserId ? (
            <CommentForm postId={postId} />
          ) : (
            <p className="text-sm text-[#78716c]">
              <Link
                href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/p/${postId}`)}`}
                className="font-medium text-[#b5522a] hover:underline"
              >
                Sign in
              </Link>{" "}
              to leave a comment.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
