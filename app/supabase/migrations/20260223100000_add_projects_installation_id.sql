-- Add installation_id for GitHub App; used to deactivate project when app is uninstalled
alter table public.projects
  add column if not exists installation_id bigint;

create index if not exists idx_projects_installation_id on public.projects(installation_id);
