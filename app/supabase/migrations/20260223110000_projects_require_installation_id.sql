-- Remove legacy projects (created without GitHub App); then require installation_id
delete from public.projects where installation_id is null;

alter table public.projects
  alter column installation_id set not null;
