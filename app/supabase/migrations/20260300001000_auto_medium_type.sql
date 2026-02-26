-- 1a. Extend type check constraint to include auto_medium
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_type_check
  CHECK (type IN ('auto_github', 'auto_medium', 'manual', 'milestone'));

-- 1b. Update XP function to give Medium articles 5 XP each
CREATE OR REPLACE FUNCTION activity_xp_delta(act_type TEXT, cnt INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE act_type
    WHEN 'auto_github' THEN GREATEST(cnt, 1)
    WHEN 'auto_medium' THEN 5
    WHEN 'manual'      THEN 5
    WHEN 'milestone'   THEN 10
    ELSE 1
  END;
END;
$$;
