-- Generic source layer: replaces project_repos.
-- Links a project to a specific resource within a connector (repo, publication, channel, etc.).

CREATE TABLE public.project_connector_sources (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_connector_id uuid        NOT NULL REFERENCES public.user_connectors(id) ON DELETE CASCADE,
  connector_type    text        NOT NULL,  -- denormalised for fast queries; 'github', 'medium', etc.
  external_id       text        NOT NULL,  -- repo_full_name, publication_id, username, etc.
  display_name      text,
  url               text,
  active            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, connector_type, external_id)
);

CREATE INDEX idx_pcs_project_id     ON public.project_connector_sources(project_id);
CREATE INDEX idx_pcs_user_connector ON public.project_connector_sources(user_connector_id);
CREATE INDEX idx_pcs_connector_type ON public.project_connector_sources(connector_type);

ALTER TABLE public.project_connector_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project connector sources are viewable by everyone"
  ON public.project_connector_sources FOR SELECT USING (true);

-- Migrate existing project_repos rows into project_connector_sources.
-- Join to user_connectors to resolve the new FK.
INSERT INTO public.project_connector_sources
  (project_id, user_connector_id, connector_type, external_id, display_name, url, active, created_at, updated_at)
SELECT
  pr.project_id,
  uc.id,
  'github',
  pr.repo_full_name,
  pr.repo_full_name,
  pr.repo_url,
  pr.active,
  pr.created_at,
  pr.updated_at
FROM public.project_repos pr
JOIN public.user_connectors uc
  ON uc.user_id = pr.user_id
 AND uc.type = 'github'
 AND uc.external_id = pr.installation_id::text
ON CONFLICT (project_id, connector_type, external_id) DO NOTHING;
