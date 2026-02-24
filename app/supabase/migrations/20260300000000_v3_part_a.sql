-- V3 Part A: Manual Check-ins & Streaks

-- 1a. activities: new columns
ALTER TABLE activities ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'auto_github';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS content_image_url TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS date_local DATE;

-- 1b. activities: drop old unique, add partial unique for auto rows
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_project_date_utc_key;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_project_id_date_utc_key;
DROP INDEX IF EXISTS activities_auto_unique;
CREATE UNIQUE INDEX activities_auto_unique
  ON activities (user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), date_utc)
  WHERE (type = 'auto_github');

-- 1c. activities: FK project_id → ON DELETE SET NULL
-- Drop whichever FK name exists, then recreate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.activities'::regclass
      AND conname = 'activities_project_id_fkey'
  ) THEN
    ALTER TABLE activities DROP CONSTRAINT activities_project_id_fkey;
  END IF;
END$$;
ALTER TABLE activities ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE activities ADD CONSTRAINT activities_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 1d. backfill
UPDATE activities SET type = 'auto_github' WHERE type IS NULL OR type = 'auto_github';
UPDATE activities SET date_local = date_utc WHERE date_local IS NULL;

-- 2. projects: add category
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT;

-- 3. users: add timezone, streak_frozen, streak_metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_frozen BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_metadata JSONB;

-- 4. PL/pgSQL RPC: increment_streak
CREATE OR REPLACE FUNCTION increment_streak(p_user_id uuid, p_date_local date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_metadata JSONB;
  v_frozen BOOLEAN;
  v_last_active DATE;
  v_current_streak INT;
  v_longest_streak INT;
  v_gap INT;
BEGIN
  -- Lock user row for atomicity
  SELECT streak_metadata, streak_frozen
  INTO v_metadata, v_frozen
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Extract current values from metadata (with defaults)
  v_last_active    := (v_metadata->>'lastActiveDayLocal')::date;
  v_current_streak := COALESCE((v_metadata->>'currentStreak')::int, 0);
  v_longest_streak := COALESCE((v_metadata->>'longestStreak')::int, 0);

  -- If this date is already counted, no-op
  IF v_last_active IS NOT NULL AND v_last_active >= p_date_local THEN
    RETURN;
  END IF;

  -- Calculate gap in days
  IF v_last_active IS NULL THEN
    v_gap := 0;
  ELSE
    v_gap := p_date_local - v_last_active;
  END IF;

  -- Update streak counter
  IF v_last_active IS NULL OR v_gap = 1 THEN
    -- First ever activity or consecutive day
    v_current_streak := v_current_streak + 1;
  ELSIF v_gap >= 3 THEN
    -- Gap of 3+ days: reset (missed day threshold exceeded)
    v_current_streak := 1;
  ELSE
    -- Gap of 2 days: still within safe window, increment
    v_current_streak := v_current_streak + 1;
  END IF;

  -- Update longest streak if needed
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Build new metadata
  v_metadata := jsonb_build_object(
    'currentStreak', v_current_streak,
    'longestStreak', v_longest_streak,
    'lastActiveDayLocal', p_date_local::text
  );

  -- Write back and clear frozen flag
  UPDATE users
  SET
    streak_metadata = v_metadata,
    streak_frozen = false,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;
