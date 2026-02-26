-- Generic connector layer: replaces user_github_installations.
-- Stores one row per (user, connector type, external identifier).

CREATE TABLE public.user_connectors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          text        NOT NULL,  -- 'github', 'medium', 'twitter', etc.
  external_id   text        NOT NULL,  -- installation_id, username, channel_id, etc.
  display_name  text,                  -- human-readable label for the UI
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, external_id)
);

CREATE INDEX idx_user_connectors_user_id ON public.user_connectors(user_id);

ALTER TABLE public.user_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connectors"
  ON public.user_connectors FOR SELECT
  USING (auth.uid() = user_id);

-- Migrate existing GitHub App installation rows
INSERT INTO public.user_connectors (user_id, type, external_id, created_at)
SELECT user_id, 'github', installation_id::text, created_at
FROM public.user_github_installations
ON CONFLICT (user_id, type, external_id) DO NOTHING;
