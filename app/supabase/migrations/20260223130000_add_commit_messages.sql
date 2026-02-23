alter table public.activities
  add column if not exists commit_messages text[] not null default '{}';
