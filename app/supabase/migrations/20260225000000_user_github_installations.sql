-- Store GitHub App installation IDs per user so we can list repos even before any repo is linked to a project.
-- Used so the connector flow can be "optional" (skip adding to project) and "available repos" still works.
create table if not exists public.user_github_installations (
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, installation_id)
);

create index if not exists idx_user_github_installations_user_id on public.user_github_installations(user_id);

alter table public.user_github_installations enable row level security;

create policy "Users can view own installations"
  on public.user_github_installations for select
  using (auth.uid() = user_id);
