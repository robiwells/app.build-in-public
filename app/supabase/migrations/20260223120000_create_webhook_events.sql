-- Track processed GitHub webhook delivery IDs to ensure idempotent processing.
-- GitHub guarantees at-least-once delivery; this prevents duplicate processing.
create table if not exists public.webhook_events (
  delivery_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

-- Auto-expire old records after 30 days to keep the table small.
-- (Handled at application level; no pg_cron required for V1.)
create index if not exists idx_webhook_events_received_at on public.webhook_events(received_at desc);

alter table public.webhook_events enable row level security;
-- No public read policy — this table is only accessed by the service role.
