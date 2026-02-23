import { createSupabaseAdmin } from "@/lib/supabase";

type PushPayload = {
  repository?: { full_name?: string; html_url?: string };
  commits?: Array<{
    sha?: string;
    timestamp?: string;
    url?: string;
  }>;
};

function parseCommitTimestamps(commits: PushPayload["commits"]): Date[] {
  if (!Array.isArray(commits)) return [];
  return commits
    .map((c) => {
      const ts = c?.timestamp;
      if (!ts) return null;
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    })
    .filter((d): d is Date => d !== null);
}

function groupByUtcDate(dates: Date[]): Map<string, { first: Date; last: Date; count: number }> {
  const map = new Map<string, { first: Date; last: Date; count: number }>();
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { first: d, last: d, count: 1 });
    } else {
      existing.count += 1;
      if (d < existing.first) existing.first = d;
      if (d > existing.last) existing.last = d;
    }
  }
  return map;
}

export async function processPushEvent(payload: unknown): Promise<void> {
  const body = payload as PushPayload;
  const repoFullName = body.repository?.full_name;
  if (!repoFullName) return;

  const supabase = createSupabaseAdmin();
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("repo_full_name", repoFullName)
    .eq("active", true)
    .maybeSingle();

  if (!project) return;

  const commits = body.commits ?? [];
  const timestamps = parseCommitTimestamps(commits);
  if (timestamps.length === 0) return;

  const byDate = groupByUtcDate(timestamps);
  const repoUrl = body.repository?.html_url ?? `https://github.com/${repoFullName}`;
  const lastCommit = commits[commits.length - 1];
  const compareUrl =
    lastCommit?.url ?? `${repoUrl}/commit/${lastCommit?.sha ?? ""}`;

  for (const [dateUtc, { first, last, count }] of byDate) {
    const githubLink = timestamps.length === 1 ? (lastCommit?.url ?? compareUrl) : compareUrl;

    const { data: existing } = await supabase
      .from("activities")
      .select("commit_count, first_commit_at, last_commit_at")
      .eq("user_id", project.user_id)
      .eq("date_utc", dateUtc)
      .maybeSingle();

    const prevFirst = existing?.first_commit_at ? new Date(existing.first_commit_at) : null;
    const prevLast = existing?.last_commit_at ? new Date(existing.last_commit_at) : null;
    const commitCount = (existing?.commit_count ?? 0) + count;
    const firstCommitAt = prevFirst && prevFirst < first ? prevFirst : first;
    const lastCommitAt = prevLast && prevLast > last ? prevLast : last;

    await supabase.from("activities").upsert(
      {
        user_id: project.user_id,
        project_id: project.id,
        date_utc: dateUtc,
        commit_count: commitCount,
        first_commit_at: firstCommitAt.toISOString(),
        last_commit_at: lastCommitAt.toISOString(),
        github_link: githubLink,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date_utc" }
    );
  }
}
