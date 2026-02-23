-- supabase/migrations/20250223120200_create_activities.sql
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  date_utc date not null,
  commit_count int not null default 0,
  first_commit_at timestamptz,
  last_commit_at timestamptz,
  github_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date_utc)
);

create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_last_commit_at on public.activities(last_commit_at desc);
create index if not exists idx_activities_date_utc on public.activities(date_utc desc);

alter table public.activities enable row level security;

create policy "Activities are viewable by everyone"
  on public.activities for select using (true);
