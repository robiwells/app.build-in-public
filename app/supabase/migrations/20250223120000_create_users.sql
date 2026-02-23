-- supabase/migrations/20250223120000_create_users.sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null unique,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_github_id on public.users(github_id);
create index if not exists idx_users_username on public.users(username);

alter table public.users enable row level security;

create policy "Users are viewable by everyone"
  on public.users for select
  using (true);
create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);
-- insert will be done by service role / API (no auth.uid() in v1 for server-side upsert)
