-- Extend type check constraint to include kanban_done
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_type_check
  CHECK (type IN ('auto_github', 'auto_medium', 'manual', 'milestone', 'kanban_done'));
