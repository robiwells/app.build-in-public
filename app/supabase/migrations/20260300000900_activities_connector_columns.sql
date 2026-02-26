-- Add generic connector columns to activities.
-- connector_source_id replaces project_repo_id as the FK to the connector layer.
-- connector_metadata holds connector-specific payload (commits, article metadata, etc.).

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS connector_source_id uuid
    REFERENCES public.project_connector_sources(id) ON DELETE SET NULL;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS connector_metadata jsonb;

-- Backfill connector_source_id from existing project_repo_id
UPDATE public.activities a
SET connector_source_id = (
  SELECT pcs.id
  FROM public.project_connector_sources pcs
  WHERE pcs.external_id = (
    SELECT repo_full_name FROM public.project_repos WHERE id = a.project_repo_id
  )
  AND pcs.connector_type = 'github'
  LIMIT 1
)
WHERE a.project_repo_id IS NOT NULL
  AND a.connector_source_id IS NULL;

-- Backfill connector_metadata for existing GitHub activities
UPDATE public.activities
SET connector_metadata = jsonb_build_object(
  'commit_count',    commit_count,
  'commit_messages', commit_messages,
  'github_link',     github_link,
  'first_commit_at', first_commit_at,
  'last_commit_at',  last_commit_at
)
WHERE type = 'auto_github'
  AND connector_metadata IS NULL;
