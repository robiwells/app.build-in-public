-- Replace project_todos with kanban board tables
DROP TABLE IF EXISTS project_todos CASCADE;

-- Columns
CREATE TABLE IF NOT EXISTS project_board_columns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) <= 50),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_board_columns_project_id_idx
  ON project_board_columns (project_id);

ALTER TABLE project_board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_columns_select" ON project_board_columns FOR SELECT USING (true);
CREATE POLICY "board_columns_owner_write" ON project_board_columns FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id AND projects.user_id = auth.uid()
  ));

-- Cards
CREATE TABLE IF NOT EXISTS project_board_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id   UUID NOT NULL REFERENCES project_board_columns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT CHECK (char_length(description) <= 2000),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_board_cards_column_id_idx
  ON project_board_cards (column_id);

ALTER TABLE project_board_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_cards_select" ON project_board_cards FOR SELECT USING (true);
CREATE POLICY "board_cards_owner_write" ON project_board_cards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id AND projects.user_id = auth.uid()
  ));
