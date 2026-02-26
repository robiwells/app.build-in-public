import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import { HeartButton } from "@/components/HeartButton";
import { EditableProjectCard } from "@/components/EditableProjectCard";
import { NewProjectButton } from "@/components/NewProjectButton";

export const revalidate = 60;

type Props = { searchParams: Promise<{ category?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const { category } = await searchParams;

  const session = await auth();
  const sessionUserId = (session?.user as { userId?: string })?.userId ?? null;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("projects")
    .select(`
      id, title, description, url, slug, category, xp, level, created_at, hearts_count, comments_count,
      users(id, username),
      activities(created_at)
    `)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.ilike("category", category);
  }

  const { data: projects } = await query;

  // Build map of project_id -> Medium display URL (for projects with Medium connector, when project.url is not set)
  const mediumDisplayUrlByProjectId = new Map<string, string>();
  if (projects && projects.length > 0) {
    const projectIds = projects.map((p) => p.id);
    const { data: mediumSources } = await supabase
      .from("project_connector_sources")
      .select("project_id, external_id")
      .in("project_id", projectIds)
      .eq("connector_type", "medium")
      .eq("active", true);
    for (const row of mediumSources ?? []) {
      const pid = row.project_id as string;
      const extId = row.external_id as string;
      if (!mediumDisplayUrlByProjectId.has(pid)) {
        mediumDisplayUrlByProjectId.set(pid, `https://medium.com/${extId}`);
      }
    }
  }

  // Build set of project IDs hearted by the current user
  let heartedSet = new Set<string>();
  if (sessionUserId && projects && projects.length > 0) {
    const projectIds = projects.map((p) => p.id);
    const { data: heartRows } = await supabase
      .from("project_hearts")
      .select("project_id")
      .eq("user_id", sessionUserId)
      .in("project_id", projectIds);
    heartedSet = new Set((heartRows ?? []).map((h: { project_id: string }) => h.project_id));
  }

  const active = category
    ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
    : "All";

  const allCats = ["All", ...CATEGORIES] as const;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
          Projects
        </h1>
        {sessionUserId && <NewProjectButton />}
      </div>

      {/* Category filter */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {allCats.map((cat) => {
          const href = cat === "All" ? "/projects" : `/projects?category=${cat.toLowerCase()}`;
          const isActive = cat === active;
          return (
            <Link
              key={cat}
              href={href}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#b5522a] text-white"
                  : "border border-[#e8ddd0] text-[#78716c] hover:border-[#c9b99a]"
              }`}
            >
              {cat}
            </Link>
          );
        })}
      </div>

      {/* Project grid */}
      {!projects || projects.length === 0 ? (
        <p className="text-sm text-[#78716c]">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const user = Array.isArray(project.users)
              ? project.users[0]
              : project.users;
            const userObj = user as { id?: string; username?: string } | null;
            const username = userObj?.username ?? null;
            const ownerId = userObj?.id ?? null;
            const isOwner =
              sessionUserId && ownerId && sessionUserId === ownerId;
            const activities = (project.activities ?? []) as { created_at: string }[];
            const postCount = activities.length;
            const lastActivityDate =
              activities.length > 0
                ? activities.reduce(
                    (max, a) =>
                      a.created_at > max ? a.created_at : max,
                    activities[0].created_at
                  )
                : null;

            const displayUrl =
              project.url ?? mediumDisplayUrlByProjectId.get(project.id) ?? null;

            if (isOwner) {
              return (
                <EditableProjectCard
                  key={project.id}
                  projectId={project.id}
                  ownerUsername={username}
                  project={{
                    id: project.id,
                    title: project.title,
                    description: project.description,
                    url: displayUrl,
                    slug: project.slug,
                    category: project.category,
                    level: project.level ?? 1,
                    hearts_count: project.hearts_count ?? 0,
                    comments_count: project.comments_count ?? 0,
                    postCount,
                    lastActivityDate,
                  }}
                  sessionUserId={sessionUserId}
                  initialHearted={heartedSet.has(project.id)}
                />
              );
            }

            const projectHref = username
              ? `/u/${username}/projects/${project.slug ?? project.id}`
              : null;
            const cardDisplayUrl =
              project.url ?? mediumDisplayUrlByProjectId.get(project.id) ?? null;

            return (
              <div
                key={project.id}
                className="card flex flex-col rounded-xl p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(120,80,40,0.14)]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {projectHref ? (
                      <Link
                        href={projectHref}
                        className="font-semibold text-[#2a1f14] hover:text-[#b5522a]"
                      >
                        {project.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[#2a1f14]">
                        {project.title}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Level {project.level ?? 1}
                    </span>
                    {project.category && (
                      <span className="rounded-full bg-[#f5f0e8] px-2 py-0.5 text-xs font-medium text-[#78716c]">
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="mb-2 line-clamp-2 text-sm text-[#78716c]">
                    {project.description}
                  </p>
                )}

                <div className="mt-auto space-y-1 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    {username && (
                      <Link
                        href={`/u/${username}`}
                        className="text-xs text-[#78716c] hover:text-[#b5522a]"
                      >
                        @{username}
                      </Link>
                    )}
                    {cardDisplayUrl && (
                      <a
                        href={cardDisplayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[55%] truncate text-xs text-[#b5522a] hover:underline"
                      >
                        {cardDisplayUrl.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#a8a29e]">
                    <span>{postCount === 1 ? "1 post" : `${postCount} posts`}</span>
                    {lastActivityDate && (
                      <>
                        <span>·</span>
                        <span>
                          updated{" "}
                          {new Date(lastActivityDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#a8a29e]">
                    <HeartButton
                      postId={project.id}
                      apiPath={`/api/projects/${project.id}/hearts`}
                      initialCount={project.hearts_count ?? 0}
                      initialHearted={heartedSet.has(project.id)}
                      currentUserId={sessionUserId}
                    />
                    {projectHref && (
                      <Link href={`${projectHref}?tab=discussion`} className="hover:text-[#b5522a]">
                        {project.comments_count ?? 0}{" "}
                        {(project.comments_count ?? 0) !== 1 ? "comments" : "comment"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
