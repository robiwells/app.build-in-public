import { createSupabaseAdmin } from "@/lib/supabase";

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

  // Look up connector source in project_connector_sources (generic connector layer)
  const pattern = repoFullName
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data: connectorSource, error: sourceError } = await supabase
    .from("project_connector_sources")
    .select("id, project_id, user_connectors!inner(user_id)")
    .eq("active", true)
    .eq("connector_type", "github")
    .ilike("external_id", pattern)
    .maybeSingle();

  if (sourceError) {
    console.error("[activity] connector_source lookup failed", { error: sourceError, repo: repoFullName, deliveryId });
    return;
  }

  if (!connectorSource) return;

  const userId = (connectorSource.user_connectors as { user_id: string }).user_id;
  const projectId = connectorSource.project_id;
  const connectorSourceId = connectorSource.id;

  // Fetch user timezone
  const { data: userRow } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", userId)
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
    const dateLocal = getLocalDateForTimestamp(first, timezone);

    const { data: existing, error: readError } = await supabase
      .from("activities")
      .select("commit_count, first_commit_at, last_commit_at, commit_messages")
      .eq("user_id", userId)
      .eq("project_id", projectId)
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

    const connectorMetadata = {
      commit_count: commitCount,
      commit_messages: commitMessages,
      github_link: githubLink,
      first_commit_at: firstCommitAt.toISOString(),
      last_commit_at: lastCommitAt.toISOString(),
    };

    const row = {
      user_id: userId,
      project_id: projectId,
      connector_source_id: connectorSourceId,
      date_utc: dateUtc,
      type: "auto_github" as const,
      date_local: dateLocal,
      // Keep writing to legacy columns during transition
      commit_count: commitCount,
      first_commit_at: firstCommitAt.toISOString(),
      last_commit_at: lastCommitAt.toISOString(),
      github_link: githubLink,
      commit_messages: commitMessages,
      connector_metadata: connectorMetadata,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("activities")
        .update({
          connector_source_id: row.connector_source_id,
          date_local: row.date_local,
          commit_count: row.commit_count,
          first_commit_at: row.first_commit_at,
          last_commit_at: row.last_commit_at,
          github_link: row.github_link,
          commit_messages: row.commit_messages,
          connector_metadata: row.connector_metadata,
          updated_at: row.updated_at,
        })
        .eq("user_id", userId)
        .eq("project_id", projectId)
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
  }
}
