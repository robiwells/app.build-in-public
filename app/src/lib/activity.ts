import { createSupabaseAdmin } from "@/lib/supabase";
import { incrementStreakAtomic } from "@/lib/streak";

type PushPayload = {
  repository?: { full_name?: string; html_url?: string };
  commits?: Array<{
    sha?: string;
    timestamp?: string;
    url?: string;
    message?: string;
  }>;
};

type CommitEntry = { date: Date; message: string };

function parseCommits(commits: PushPayload["commits"]): CommitEntry[] {
  if (!Array.isArray(commits)) return [];
  return commits
    .flatMap((c) => {
      const ts = c?.timestamp;
      if (!ts) return [];
      const d = new Date(ts);
      if (isNaN(d.getTime())) return [];
      const message = (c?.message ?? "").split("\n")[0].trim();
      return [{ date: d, message }];
    });
}

function groupCommitsByUtcDate(
  commits: CommitEntry[]
): Map<string, { first: Date; last: Date; count: number; messages: string[] }> {
  const map = new Map<string, { first: Date; last: Date; count: number; messages: string[] }>();
  for (const { date: d, message } of commits) {
    const key = d.toISOString().slice(0, 10);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { first: d, last: d, count: 1, messages: message ? [message] : [] });
    } else {
      existing.count += 1;
      if (d < existing.first) existing.first = d;
      if (d > existing.last) existing.last = d;
      if (message) existing.messages.push(message);
    }
  }
  return map;
}

function getLocalDateForTimestamp(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function processPushEvent(payload: unknown, deliveryId?: string): Promise<void> {
  const body = payload as PushPayload;
  const repoFullName = body.repository?.full_name;
  if (!repoFullName) return;

  const supabase = createSupabaseAdmin();

  // Look up repo in project_repos (V2 schema)
  const pattern = repoFullName
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: projectRepo, error: repoError } = await supabase
    .from("project_repos")
    .select("id, project_id, user_id")
    .eq("active", true)
    .ilike("repo_full_name", pattern)
    .maybeSingle();

  if (repoError) {
    console.error("[activity] project_repo lookup failed", { error: repoError, repo: repoFullName, deliveryId });
    return;
  }

  if (!projectRepo) return;

  // Fetch user timezone
  const { data: userRow } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", projectRepo.user_id)
    .maybeSingle();
  const timezone = userRow?.timezone ?? "UTC";

  const commits = body.commits ?? [];
  const commitEntries = parseCommits(commits);
  if (commitEntries.length === 0) return;

  const byDate = groupCommitsByUtcDate(commitEntries);
  const repoUrl = body.repository?.html_url ?? `https://github.com/${repoFullName}`;
  const lastCommit = commits[commits.length - 1];
  const compareUrl =
    lastCommit?.url ?? `${repoUrl}/commit/${lastCommit?.sha ?? ""}`;

  for (const [dateUtc, { first, last, count, messages: newMessages }] of byDate) {
    const githubLink = commitEntries.length === 1 ? (lastCommit?.url ?? compareUrl) : compareUrl;
    // Compute date_local based on the push timestamp (use first commit time for this UTC date)
    const dateLocal = getLocalDateForTimestamp(first, timezone);

    const { data: existing, error: readError } = await supabase
      .from("activities")
      .select("commit_count, first_commit_at, last_commit_at, commit_messages")
      .eq("user_id", projectRepo.user_id)
      .eq("project_id", projectRepo.project_id)
      .eq("date_utc", dateUtc)
      .eq("type", "auto_github")
      .maybeSingle();

    if (readError) {
      console.error("[activity] existing activity read failed", { error: readError, repo: repoFullName, date: dateUtc, deliveryId });
      continue;
    }

    const prevFirst = existing?.first_commit_at ? new Date(existing.first_commit_at) : null;
    const prevLast = existing?.last_commit_at ? new Date(existing.last_commit_at) : null;
    const commitCount = (existing?.commit_count ?? 0) + count;
    const firstCommitAt = prevFirst && prevFirst < first ? prevFirst : first;
    const lastCommitAt = prevLast && prevLast > last ? prevLast : last;
    const existingMessages: string[] = existing?.commit_messages ?? [];
    const commitMessages = [...new Set([...existingMessages, ...newMessages])];

    const row = {
      user_id: projectRepo.user_id,
      project_id: projectRepo.project_id,
      project_repo_id: projectRepo.id,
      date_utc: dateUtc,
      type: "auto_github" as const,
      date_local: dateLocal,
      commit_count: commitCount,
      first_commit_at: firstCommitAt.toISOString(),
      last_commit_at: lastCommitAt.toISOString(),
      github_link: githubLink,
      commit_messages: commitMessages,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("activities")
        .update({
          project_repo_id: row.project_repo_id,
          date_local: row.date_local,
          commit_count: row.commit_count,
          first_commit_at: row.first_commit_at,
          last_commit_at: row.last_commit_at,
          github_link: row.github_link,
          commit_messages: row.commit_messages,
          updated_at: row.updated_at,
        })
        .eq("user_id", projectRepo.user_id)
        .eq("project_id", projectRepo.project_id)
        .eq("date_utc", dateUtc)
        .eq("type", "auto_github");

      if (updateError) {
        console.error("[activity] update failed", { error: updateError, repo: repoFullName, date: dateUtc, deliveryId });
        continue;
      }
    } else {
      const { error: insertError } = await supabase.from("activities").insert(row);

      if (insertError) {
        console.error("[activity] insert failed", { error: insertError, repo: repoFullName, date: dateUtc, deliveryId });
        continue;
      }
    }

    // Update streak atomically
    await incrementStreakAtomic(projectRepo.user_id, dateLocal);
  }
}
