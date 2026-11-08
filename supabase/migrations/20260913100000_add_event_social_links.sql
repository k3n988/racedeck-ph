alter table public.events
  add column if not exists social_links jsonb not null default '{}'::jsonb;
