import { createSupabaseAdmin } from "@/lib/supabase";

export interface CreateProjectParams {
  title: string;
  description?: string | null;
  url?: string | null;
}

export interface UpdateProjectParams {
  title?: string;
  description?: string | null;
  url?: string | null;
}

export interface AddRepoParams {
  repoFullName: string;
  repoUrl: string;
  installationId: number;
}

export async function createProject(
  userId: string,
  params: CreateProjectParams
): Promise<{ projectId: string | null; error: string | null }> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: params.title,
      description: params.description ?? null,
      url: params.url ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[projects] create failed", { error, userId });
    return { projectId: null, error: error.message };
  }
  return { projectId: data.id, error: null };
}

export async function updateProject(
  projectId: string,
  userId: string,
  params: UpdateProjectParams
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdmin();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.url !== undefined) updates.url = params.url;

  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("[projects] update failed", { error, projectId, userId });
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteProject(
  projectId: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdmin();

  // Cascade will remove project_repos rows. Activities keep their project_id
  // but the project row is gone — we soft-delete instead so feed history is preserved.
  const { error } = await supabase
    .from("projects")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("[projects] delete failed", { error, projectId, userId });
    return { error: error.message };
  }
  return { error: null };
}

export async function addRepoToProject(
  projectId: string,
  userId: string,
  params: AddRepoParams
): Promise<{ repoId: string | null; error: string | null }> {
  const supabase = createSupabaseAdmin();

  // Verify the project belongs to this user
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!project) {
    return { repoId: null, error: "Project not found" };
  }

  const { data, error } = await supabase
    .from("project_repos")
    .insert({
      project_id: projectId,
      user_id: userId,
      installation_id: params.installationId,
      repo_full_name: params.repoFullName,
      repo_url: params.repoUrl,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { repoId: null, error: "This repo is already tracked" };
    }
    console.error("[projects] add repo failed", { error, projectId, userId });
    return { repoId: null, error: error.message };
  }
  return { repoId: data.id, error: null };
}

export async function removeRepoFromProject(
  repoId: string,
  projectId: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("project_repos")
    .delete()
    .eq("id", repoId)
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("[projects] remove repo failed", { error, repoId, projectId, userId });
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Create a project and link a repo in one step (used during onboarding).
 */
export async function createProjectWithRepo(
  userId: string,
  project: CreateProjectParams,
  repo: AddRepoParams
): Promise<{ projectId: string | null; error: string | null }> {
  const { projectId, error: createError } = await createProject(userId, project);
  if (createError || !projectId) {
    return { projectId: null, error: createError };
  }

  const { error: repoError } = await addRepoToProject(projectId, userId, repo);
  if (repoError) {
    return { projectId, error: repoError };
  }

  return { projectId, error: null };
}
