-- Remove streak mechanism: drop columns and RPC.
-- Timezone and activities.date_local are kept for the activity heatmap on profiles.

ALTER TABLE users DROP COLUMN IF EXISTS streak_frozen;
ALTER TABLE users DROP COLUMN IF EXISTS streak_metadata;

DROP FUNCTION IF EXISTS increment_streak(uuid, date);
