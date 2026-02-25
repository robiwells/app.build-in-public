-- Project XP & Levels
-- Each activity awards XP to its project; projects level up on a quadratic curve.
-- Level N requires total XP >= 5*(N-1)*N
-- XP per activity: auto_github = commit_count (min 1), manual = 5, milestone = 10

-- 1. Add columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS xp    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- 2. Level formula: level = FLOOR((1 + SQRT(1 + xp/1.25)) / 2), minimum 1
CREATE OR REPLACE FUNCTION project_level_from_xp(xp_val INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN GREATEST(1, FLOOR((1 + SQRT(1 + xp_val::FLOAT / 1.25)) / 2)::INTEGER);
END;
$$;

-- 3. XP delta per activity
CREATE OR REPLACE FUNCTION activity_xp_delta(act_type TEXT, cnt INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE act_type
    WHEN 'auto_github' THEN GREATEST(cnt, 1)
    WHEN 'manual'      THEN 5
    WHEN 'milestone'   THEN 10
    ELSE 1
  END;
END;
$$;

-- 4. Trigger function: maintain project xp/level on activity changes
CREATE OR REPLACE FUNCTION trg_update_project_xp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  -- Subtract XP for DELETE / old row on UPDATE
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.project_id IS NOT NULL THEN
    v_delta := activity_xp_delta(OLD.type, OLD.commit_count);
    UPDATE public.projects
    SET xp    = GREATEST(0, xp - v_delta),
        level = project_level_from_xp(GREATEST(0, xp - v_delta))
    WHERE id = OLD.project_id;
  END IF;

  -- Add XP for INSERT / new row on UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.project_id IS NOT NULL THEN
    v_delta := activity_xp_delta(NEW.type, NEW.commit_count);
    UPDATE public.projects
    SET xp    = xp + v_delta,
        level = project_level_from_xp(xp + v_delta)
    WHERE id = NEW.project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Attach trigger to activities
DROP TRIGGER IF EXISTS trg_project_xp ON public.activities;
CREATE TRIGGER trg_project_xp
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION trg_update_project_xp();

-- 6. Backfill existing projects from their current activities
UPDATE public.projects p
SET xp    = sub.total_xp::INTEGER,
    level = project_level_from_xp(sub.total_xp::INTEGER)
FROM (
  SELECT project_id,
         SUM(activity_xp_delta(type::TEXT, commit_count::INTEGER)) AS total_xp
  FROM   public.activities
  WHERE  project_id IS NOT NULL
  GROUP  BY project_id
) sub
WHERE p.id = sub.project_id;
