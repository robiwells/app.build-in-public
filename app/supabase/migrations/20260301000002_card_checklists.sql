CREATE TABLE IF NOT EXISTS project_board_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES project_board_cards(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (char_length(text) <= 200),
  completed  BOOLEAN NOT NULL DEFAULT false,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checklist_items_card_id_idx
  ON project_board_checklist_items (card_id);

ALTER TABLE project_board_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select" ON project_board_checklist_items
  FOR SELECT USING (true);

CREATE POLICY "checklist_items_owner_write" ON project_board_checklist_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id AND projects.user_id = auth.uid()
  ));
