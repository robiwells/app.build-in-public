-- Add slug to projects for shareable URLs (e.g. /u/username/projects/my-project)
-- Slug is unique per user and derived from title; backfill existing rows.

alter table public.projects
  add column if not exists slug text;

-- Slugify: lowercase, replace non-alphanumeric/space with single hyphen, trim
create or replace function slugify(t text)
returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(regexp_replace(coalesce(trim(t), ''), '[^a-zA-Z0-9\s-]', '', 'g')),
    '\s+', '-', 'g'
  ));
$$;

-- Backfill: set slug per project, unique per user (append -2, -3 for duplicates)
with base as (
  select
    id,
    user_id,
    slugify(title) as base_slug
  from public.projects
  where slug is null or slug = ''
),
numbered as (
  select
    id,
    user_id,
    base_slug,
    case when base_slug = '' then 'project' else base_slug end as safe_slug,
    row_number() over (partition by user_id, case when base_slug = '' then 'project' else base_slug end order by id) as rn
  from base
)
update public.projects p
set slug = n.safe_slug || case when n.rn > 1 then '-' || n.rn else '' end
from numbered n
where p.id = n.id;

-- Unique constraint: one slug per user
create unique index if not exists projects_user_slug_key
  on public.projects (user_id, slug)
  where slug is not null and slug != '';
