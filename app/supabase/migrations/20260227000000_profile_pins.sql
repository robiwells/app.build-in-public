-- Add pinned project and activity to users table for portfolio curation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pinned_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
