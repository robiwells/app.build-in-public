CREATE TABLE IF NOT EXISTS project_todos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text        TEXT NOT NULL CHECK (char_length(text) <= 200),
  completed   BOOLEAN NOT NULL DEFAULT false,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_todos_project_id_idx ON project_todos (project_id);

ALTER TABLE project_todos ENABLE ROW LEVEL SECURITY;

-- Anyone can read todos
CREATE POLICY "project_todos_select"
  ON project_todos FOR SELECT
  USING (true);

-- Only project owner can insert/update/delete
CREATE POLICY "project_todos_owner_write"
  ON project_todos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_id
        AND projects.user_id = auth.uid()
    )
  );
