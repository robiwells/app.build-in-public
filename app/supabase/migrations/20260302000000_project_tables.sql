-- project_tables: one per project, ordered
CREATE TABLE project_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON project_tables(project_id);

-- project_table_columns: typed columns per table
CREATE TABLE project_table_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID NOT NULL REFERENCES project_tables(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  type        TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'url')),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON project_table_columns(table_id);

-- project_table_rows: ordered rows per table
CREATE TABLE project_table_rows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID NOT NULL REFERENCES project_tables(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON project_table_rows(table_id);

-- project_table_cells: one per (row, column) pair
CREATE TABLE project_table_cells (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id      UUID NOT NULL REFERENCES project_table_rows(id) ON DELETE CASCADE,
  column_id   UUID NOT NULL REFERENCES project_table_columns(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (row_id, column_id)
);
CREATE INDEX ON project_table_cells(row_id);

-- RLS (same pattern as board tables)
ALTER TABLE project_tables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_table_columns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_table_rows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_table_cells       ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "tables_select"         ON project_tables         FOR SELECT USING (true);
CREATE POLICY "table_columns_select"  ON project_table_columns  FOR SELECT USING (true);
CREATE POLICY "table_rows_select"     ON project_table_rows     FOR SELECT USING (true);
CREATE POLICY "table_cells_select"    ON project_table_cells    FOR SELECT USING (true);

-- Owner write (via projects.user_id)
CREATE POLICY "tables_owner_write"    ON project_tables FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid()));
CREATE POLICY "table_columns_owner"   ON project_table_columns FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid()));
CREATE POLICY "table_rows_owner"      ON project_table_rows FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid()));
CREATE POLICY "table_cells_owner"     ON project_table_cells FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid()));
