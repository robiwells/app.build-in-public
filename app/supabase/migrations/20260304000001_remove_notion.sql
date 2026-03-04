-- Remove all notion connector sources
DELETE FROM project_connector_sources
WHERE user_connector_id IN (
  SELECT id FROM user_connectors WHERE type = 'notion'
);

-- Remove all notion connectors
DELETE FROM user_connectors WHERE type = 'notion';

-- Drop access_token column (added by notion migration, not used by other connectors)
ALTER TABLE user_connectors DROP COLUMN IF EXISTS access_token;
