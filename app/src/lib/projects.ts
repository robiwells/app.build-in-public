import { createSupabaseAdmin } from "@/lib/supabase";

export interface CreateProjectParams {
  title: string;
  description?: string | null;
  url?: string | null;
  category?: string | null;
}

export interface UpdateProjectParams {
  title?: string;
  description?: string | null;
  url?: string | null;
  category?: string | null;
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
      category: params.category ?? null,
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
  if (params.category !== undefined) updates.category = params.category;

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

  // Check if a row already exists for this user + repo (possibly soft-deleted)
  const { data: existing } = await supabase
    .from("project_repos")
    .select("id, active, project_id")
    .eq("user_id", userId)
    .eq("repo_full_name", params.repoFullName)
    .maybeSingle();

  if (existing) {
    if (existing.active) {
      return { repoId: null, error: "This repo is already tracked" };
    }
    // Re-activate and move to the target project
    const { error } = await supabase
      .from("project_repos")
      .update({
        active: true,
        project_id: projectId,
        installation_id: params.installationId,
        repo_url: params.repoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[projects] re-activate repo failed", { error, projectId, userId });
      return { repoId: null, error: error.message };
    }
    return { repoId: existing.id, error: null };
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

  // Soft-delete so historical activity posts retain their repo info.
  const { error } = await supabase
    .from("project_repos")
    .update({ active: false, updated_at: new Date().toISOString() })
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
 * Create a project and link one or more repos in one step (used during onboarding).
 */
export async function createProjectWithRepos(
  userId: string,
  project: CreateProjectParams,
  repos: AddRepoParams[]
): Promise<{ projectId: string | null; error: string | null }> {
  const { projectId, error: createError } = await createProject(userId, project);
  if (createError || !projectId) {
    return { projectId: null, error: createError };
  }

  for (const repo of repos) {
    const { error: repoError } = await addRepoToProject(projectId, userId, repo);
    if (repoError) {
      return { projectId, error: repoError };
    }
  }

  return { projectId, error: null };
}
