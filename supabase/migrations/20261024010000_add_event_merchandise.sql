create table if not exists public.event_merchandise (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  image_urls text[] not null default '{}',
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_merchandise_event_active_order_idx
  on public.event_merchandise (event_id, is_active, display_order);

alter table public.event_merchandise enable row level security;
grant select, insert, update, delete on public.event_merchandise to service_role;

create table if not exists public.registration_merchandise (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_merchandise_id uuid not null references public.event_merchandise(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_name text not null,
  variant text,
  quantity integer not null check (quantity between 1 and 10),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  line_total numeric(12, 2) not null check (line_total > 0 and line_total = round(unit_price * quantity, 2)),
  created_at timestamptz not null default now()
);

create index if not exists registration_merchandise_registration_idx
  on public.registration_merchandise (registration_id);

alter table public.registration_merchandise enable row level security;
grant select, insert, update, delete on public.registration_merchandise to service_role;
grant select on public.registration_merchandise to authenticated;

create policy registration_merchandise_participant_read
  on public.registration_merchandise for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = auth.uid()
  ));

create or replace function public.guard_event_merchandise_review_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_review_status public.event_review_status;
  v_lifecycle_status public.event_lifecycle_status;
begin
  if tg_op = 'UPDATE' and old.event_id <> new.event_id then
    raise exception 'Merchandise cannot be moved between events';
  end if;
  v_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  select review_status, lifecycle_status into v_review_status, v_lifecycle_status
    from public.events where id = v_event_id for update;
  if not found then raise exception 'Merchandise event not found'; end if;
  if v_lifecycle_status <> 'draft' or v_review_status in ('pending_review', 'approved') then
    raise exception 'Merchandise is locked after event submission for review';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_event_merchandise_review_snapshot on public.event_merchandise;
create trigger guard_event_merchandise_review_snapshot
before insert or update or delete on public.event_merchandise
for each row execute function public.guard_event_merchandise_review_snapshot();

create or replace function public.set_event_merchandise_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger event_merchandise_set_updated_at
before update on public.event_merchandise
for each row execute function public.set_event_merchandise_updated_at();
