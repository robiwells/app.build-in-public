ALTER TABLE activities
  ADD CONSTRAINT activities_type_check
  CHECK (type IN ('auto_github', 'manual', 'milestone'));
