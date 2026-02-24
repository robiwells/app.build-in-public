-- hearts
CREATE TABLE IF NOT EXISTS hearts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS hearts_post_id_idx ON hearts (post_id);

ALTER TABLE hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hearts are viewable by everyone"
  ON hearts FOR SELECT USING (true);
CREATE POLICY "Users can manage own hearts"
  ON hearts FOR ALL USING (auth.uid() = user_id);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own comments"
  ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE USING (auth.uid() = user_id);

-- counter cache columns on activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS hearts_count INT NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;

-- trigger: maintain hearts_count
CREATE OR REPLACE FUNCTION trg_hearts_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE activities SET hearts_count = hearts_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE activities SET hearts_count = GREATEST(hearts_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS hearts_count_trigger ON hearts;
CREATE TRIGGER hearts_count_trigger
AFTER INSERT OR DELETE ON hearts FOR EACH ROW EXECUTE FUNCTION trg_hearts_count();

-- trigger: maintain comments_count
CREATE OR REPLACE FUNCTION trg_comments_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE activities SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE activities SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS comments_count_trigger ON comments;
CREATE TRIGGER comments_count_trigger
AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION trg_comments_count();
