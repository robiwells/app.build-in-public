-- Store URL of captured project website screenshot (captured when project has url)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS screenshot_url text;
