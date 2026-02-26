-- Add counter cache columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hearts_count INT NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;

-- project_hearts
CREATE TABLE IF NOT EXISTS project_hearts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);
CREATE INDEX IF NOT EXISTS project_hearts_project_id_idx ON project_hearts (project_id);

ALTER TABLE project_hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project hearts are viewable by everyone"
  ON project_hearts FOR SELECT USING (true);
CREATE POLICY "Users can manage own project hearts"
  ON project_hearts FOR ALL USING (auth.uid() = user_id);

-- project_comments
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_comments_project_id_idx ON project_comments (project_id);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project comments are viewable by everyone"
  ON project_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own project comments"
  ON project_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own project comments"
  ON project_comments FOR DELETE USING (auth.uid() = user_id);

-- trigger: maintain projects.hearts_count
CREATE OR REPLACE FUNCTION trg_project_hearts_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET hearts_count = hearts_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET hearts_count = GREATEST(hearts_count - 1, 0) WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS project_hearts_count_trigger ON project_hearts;
CREATE TRIGGER project_hearts_count_trigger
AFTER INSERT OR DELETE ON project_hearts FOR EACH ROW EXECUTE FUNCTION trg_project_hearts_count();

-- trigger: maintain projects.comments_count
CREATE OR REPLACE FUNCTION trg_project_comments_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET comments_count = comments_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS project_comments_count_trigger ON project_comments;
CREATE TRIGGER project_comments_count_trigger
AFTER INSERT OR DELETE ON project_comments FOR EACH ROW EXECUTE FUNCTION trg_project_comments_count();
