import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/constants";
import { levelProgressPct } from "@/lib/xp";

export const revalidate = 60;

type Props = { searchParams: Promise<{ category?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const { category } = await searchParams;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("projects")
    .select(`
      id, title, description, url, slug, category, xp, level, created_at,
      users(id, username),
      activities(created_at)
    `)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.ilike("category", category);
  }

  const { data: projects } = await query;

  const active = category
    ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
    : "All";

  const allCats = ["All", ...CATEGORIES] as const;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#2a1f14]">
        Projects
      </h1>

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
            const username = (user as { username?: string } | null)?.username ?? null;
            const activities = (project.activities ?? []) as { created_at: string }[];
            const postCount = activities.length;
            const lastActivityDate = activities.length > 0
              ? activities.reduce((max, a) => a.created_at > max ? a.created_at : max, activities[0].created_at)
              : null;
            const projectHref = username
              ? `/u/${username}/projects/${project.slug ?? project.id}`
              : null;

            return (
              <div
                key={project.id}
                className="card rounded-xl p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(120,80,40,0.14)]"
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

                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    {username && (
                      <Link
                        href={`/u/${username}`}
                        className="text-xs text-[#78716c] hover:text-[#b5522a]"
                      >
                        @{username}
                      </Link>
                    )}
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[55%] truncate text-xs text-[#b5522a] hover:underline"
                      >
                        {project.url.replace(/^https?:\/\//, "")}
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
                </div>
                <div className="mt-3 overflow-hidden rounded-full bg-[#e8ddd0]" style={{ height: "6px" }}>
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${levelProgressPct((project.xp as number) ?? 0, project.level ?? 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
