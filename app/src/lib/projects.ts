import { createSupabaseAdmin } from "@/lib/supabase";

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "project";
}

async function ensureUniqueSlug(
  userId: string,
  baseSlug: string,
  excludeProjectId?: string
): Promise<string> {
  const supabase = createSupabaseAdmin();
  let slug = baseSlug;
  let n = 1;
  for (;;) {
    let query = supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug);
    if (excludeProjectId) query = query.neq("id", excludeProjectId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${++n}`;
  }
}

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
  const slug = await ensureUniqueSlug(userId, slugify(params.title));
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: params.title,
      description: params.description ?? null,
      url: params.url ?? null,
      category: params.category ?? null,
      slug,
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

  if (params.title !== undefined) {
    const slug = await ensureUniqueSlug(userId, slugify(params.title), projectId);
    updates.slug = slug;
  }

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

  // Get or create the user_connector for this installation
  let { data: connector } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "github")
    .eq("external_id", String(params.installationId))
    .maybeSingle();

  if (!connector) {
    const { data: newConnector, error: connectorError } = await supabase
      .from("user_connectors")
      .insert({ user_id: userId, type: "github", external_id: String(params.installationId) })
      .select("id")
      .single();
    if (connectorError || !newConnector) {
      console.error("[projects] connector insert failed", { connectorError, userId });
      return { repoId: null, error: connectorError?.message ?? "Connector error" };
    }
    connector = newConnector;
  }

  // Check if a row already exists for this project + repo (possibly soft-deleted)
  const { data: existing } = await supabase
    .from("project_connector_sources")
    .select("id, active")
    .eq("project_id", projectId)
    .eq("connector_type", "github")
    .eq("external_id", params.repoFullName)
    .maybeSingle();

  if (existing) {
    if (existing.active) {
      return { repoId: null, error: "This repo is already tracked" };
    }
    // Re-activate and update connector reference
    const { error } = await supabase
      .from("project_connector_sources")
      .update({
        active: true,
        user_connector_id: connector.id,
        url: params.repoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[projects] re-activate connector source failed", { error, projectId, userId });
      return { repoId: null, error: error.message };
    }
    return { repoId: existing.id, error: null };
  }

  const { data, error } = await supabase
    .from("project_connector_sources")
    .insert({
      project_id: projectId,
      user_connector_id: connector.id,
      connector_type: "github",
      external_id: params.repoFullName,
      display_name: params.repoFullName,
      url: params.repoUrl,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[projects] add connector source failed", { error, projectId, userId });
    return { repoId: null, error: error.message };
  }
  return { repoId: data.id, error: null };
}

export async function removeRepoFromProject(
  sourceId: string,
  projectId: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdmin();

  // Resolve user's connector IDs to verify ownership before soft-delete.
  const { data: userConnectors } = await supabase
    .from("user_connectors")
    .select("id")
    .eq("user_id", userId);

  const connectorIds = (userConnectors ?? []).map((c) => c.id);
  if (connectorIds.length === 0) {
    return { error: "No connectors found for user" };
  }

  // Soft-delete so historical activity posts retain their connector_source_id.
  const { error } = await supabase
    .from("project_connector_sources")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("project_id", projectId)
    .in("user_connector_id", connectorIds);

  if (error) {
    console.error("[projects] remove connector source failed", { error, sourceId, projectId, userId });
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
