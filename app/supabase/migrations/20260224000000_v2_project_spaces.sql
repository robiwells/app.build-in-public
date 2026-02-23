-- V2: Project Spaces migration
-- Restructures projects as an organisational entity and extracts repos into project_repos.

-- 1. Add new project-space columns
alter table public.projects
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists url text;

-- 2. Backfill title from repo_full_name (use the repo portion after '/')
update public.projects
set title = coalesce(
  nullif(split_part(repo_full_name, '/', 2), ''),
  repo_full_name
)
where title is null;

-- 3. Create project_repos table
create table if not exists public.project_repos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id bigint not null,
  repo_full_name text not null,
  repo_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, repo_full_name)
);

create index if not exists idx_project_repos_project_id on public.project_repos(project_id);
create index if not exists idx_project_repos_user_id on public.project_repos(user_id);
create index if not exists idx_project_repos_installation_id on public.project_repos(installation_id);

alter table public.project_repos enable row level security;

create policy "Project repos are viewable by everyone"
  on public.project_repos for select using (true);

-- 4. Copy existing project repo data into project_repos
insert into public.project_repos (project_id, user_id, installation_id, repo_full_name, repo_url, active)
select id, user_id, installation_id, repo_full_name, repo_url, active
from public.projects
where repo_full_name is not null
on conflict (user_id, repo_full_name) do nothing;

-- 5. Drop the unique(user_id) constraint so users can have multiple projects.
-- The constraint name may vary; use the pg_constraint catalog to find it.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.projects'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 1
    and conkey[1] = (
      select attnum from pg_attribute
      where attrelid = 'public.projects'::regclass and attname = 'user_id'
    );
  if cname is not null then
    execute format('alter table public.projects drop constraint %I', cname);
  end if;
end$$;

-- 6. Make title NOT NULL now that backfill is done
alter table public.projects alter column title set not null;

-- 7. Drop repo columns from projects (no longer needed)
alter table public.projects
  drop column if exists repo_full_name,
  drop column if exists repo_url,
  drop column if exists installation_id;

-- 8. Update activities unique constraint: (user_id, date_utc) → (user_id, project_id, date_utc)
-- Drop old constraint
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.activities'::regclass
    and contype = 'u';
  if cname is not null then
    execute format('alter table public.activities drop constraint %I', cname);
  end if;
end$$;

alter table public.activities
  add constraint activities_user_project_date_utc_key unique (user_id, project_id, date_utc);

-- 9. Add project_repo_id to activities
alter table public.activities
  add column if not exists project_repo_id uuid references public.project_repos(id) on delete set null;
