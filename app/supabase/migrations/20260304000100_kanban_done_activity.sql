-- Add kanban_done activity type (5 XP per card completion)
CREATE OR REPLACE FUNCTION activity_xp_delta(act_type TEXT, cnt INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE act_type
    WHEN 'auto_github'  THEN GREATEST(cnt, 1)
    WHEN 'manual'       THEN 5
    WHEN 'milestone'    THEN 10
    WHEN 'kanban_done'  THEN 5
    ELSE 1
  END;
END;
$$;
