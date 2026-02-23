import { createSupabaseAdmin } from "@/lib/supabase";

interface UpsertProjectParams {
  repoFullName: string;
  repoUrl: string;
  installationId: number;
}

/**
 * Upsert the single project record for a user.
 * If a project already exists for the user (regardless of active status), it is
 * updated; otherwise a new row is inserted.
 */
export async function upsertProject(
  userId: string,
  { repoFullName, repoUrl, installationId }: UpsertProjectParams
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdmin();

  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("projects")
      .update({
        active: true,
        repo_full_name: repoFullName,
        repo_url: repoUrl,
        installation_id: installationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[projects] upsert update failed", { error, userId, repo: repoFullName });
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("projects").insert({
      user_id: userId,
      repo_full_name: repoFullName,
      repo_url: repoUrl,
      installation_id: installationId,
    });
    if (error) {
      console.error("[projects] upsert insert failed", { error, userId, repo: repoFullName });
      return { error: error.message };
    }
  }

  return { error: null };
}
