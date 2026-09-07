-- ============================================================
-- RaceDeck PH — Migration 007: Race Operations
--
-- Bib assignment and race-kit claiming are operational records, not part of
-- the registration QR credential. Claim and assignment writes are protected
-- by RLS, relationship guards, and unique indexes.
-- ============================================================

create type bib_status as enum ('unassigned', 'active', 'released', 'void');
create type bib_assignment_source as enum ('manual', 'sequential', 'bulk', 'reassignment');
create type race_kit_config_status as enum ('active', 'inactive');
create type race_kit_claim_method as enum ('qr_scan', 'manual_lookup');

-- ============================================================
-- BIBS
-- ============================================================
create table public.bibs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  category_id uuid not null references public.race_categories(id) on delete restrict,
  registration_id uuid references public.registrations(id) on delete restrict,
  bib_number integer not null,
  bib_code text not null,
  prefix text,
  status bib_status not null default 'unassigned',
  assignment_source bib_assignment_source,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  released_by uuid references auth.users(id) on delete set null,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bibs_number_positive check (bib_number > 0),
  constraint bibs_code_not_blank check (btrim(bib_code) <> ''),
  constraint bibs_prefix_not_blank check (prefix is null or btrim(prefix) <> ''),
  constraint bibs_active_requires_registration check (
    status <> 'active' or registration_id is not null
  ),
  constraint bibs_assignment_metadata_consistent check (
    (status = 'unassigned' and assigned_at is null)
    or (status in ('active', 'released', 'void') and assigned_at is not null)
  ),
  constraint bibs_release_metadata_consistent check (
    status <> 'released' or released_at is not null
  )
);

create unique index bibs_active_registration_uidx
  on public.bibs (registration_id)
  where status = 'active' and registration_id is not null;
create unique index bibs_active_number_uidx
  on public.bibs (event_id, bib_number)
  where status = 'active';
create unique index bibs_active_code_uidx
  on public.bibs (event_id, bib_code)
  where status = 'active';
create index bibs_event_category_idx on public.bibs (event_id, category_id);
create index bibs_registration_idx on public.bibs (registration_id);
create index bibs_event_number_idx on public.bibs (event_id, bib_number);
create index bibs_event_status_idx on public.bibs (event_id, status);

-- Existing registrations reserved bib_id for this module.
alter table public.registrations
  add constraint registrations_bib_id_fkey
  foreign key (bib_id) references public.bibs(id) on delete set null;
create index idx_registrations_bib on public.registrations (bib_id);

-- ============================================================
-- RACE KIT CONFIGURATION
-- ============================================================
create table public.race_kit_configs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  category_id uuid references public.race_categories(id) on delete restrict,
  name text not null,
  description text,
  status race_kit_config_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint race_kit_configs_name_not_blank check (btrim(name) <> ''),
  constraint race_kit_configs_description_not_blank check (
    description is null or btrim(description) <> ''
  )
);

create unique index race_kit_configs_event_default_uidx
  on public.race_kit_configs (event_id)
  where category_id is null;
create unique index race_kit_configs_event_category_uidx
  on public.race_kit_configs (event_id, category_id)
  where category_id is not null;
create index race_kit_configs_event_idx on public.race_kit_configs (event_id, status);
create index race_kit_configs_category_idx on public.race_kit_configs (category_id);

create table public.race_kit_items (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.race_kit_configs(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  quantity integer not null default 1,
  details jsonb not null default '{}'::jsonb,
  is_required boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint race_kit_items_code_not_blank check (btrim(item_code) <> ''),
  constraint race_kit_items_name_not_blank check (btrim(item_name) <> ''),
  constraint race_kit_items_quantity_positive check (quantity > 0),
  constraint race_kit_items_display_order_nonnegative check (display_order >= 0),
  unique (config_id, item_code)
);

create index race_kit_items_config_idx on public.race_kit_items (config_id, display_order);

-- ============================================================
-- RACE KIT CLAIMS
-- ============================================================
create table public.race_kit_claims (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  category_id uuid not null references public.race_categories(id) on delete restrict,
  bib_id uuid not null references public.bibs(id) on delete restrict,
  config_id uuid not null references public.race_kit_configs(id) on delete restrict,
  claimed_by uuid not null references auth.users(id) on delete restrict,
  claim_method race_kit_claim_method not null,
  scan_reference text,
  metadata jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint race_kit_claims_scan_reference check (
    claim_method <> 'qr_scan' or nullif(btrim(scan_reference), '') is not null
  ),
  constraint race_kit_claims_manual_reference check (
    claim_method <> 'manual_lookup' or scan_reference is null or btrim(scan_reference) <> ''
  )
);

create index race_kit_claims_event_category_idx
  on public.race_kit_claims (event_id, category_id);
create index race_kit_claims_bib_idx on public.race_kit_claims (bib_id);
create index race_kit_claims_config_idx on public.race_kit_claims (config_id);
create index race_kit_claims_claimed_by_idx on public.race_kit_claims (claimed_by);
create index race_kit_claims_claimed_at_idx on public.race_kit_claims (claimed_at desc);

-- ============================================================
-- RELATIONSHIP AND STATE GUARDS
-- ============================================================
create or replace function public.validate_bib_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_category_prefix text;
  v_range_start integer;
  v_range_end integer;
begin
  select rc.bib_prefix, rc.bib_range_start, rc.bib_range_end
    into v_category_prefix, v_range_start, v_range_end
  from public.race_categories rc
  where rc.id = new.category_id and rc.event_id = new.event_id;
  if not found then
    raise exception 'bib category must belong to its event';
  end if;

  if v_range_start is not null and new.bib_number < v_range_start then
    raise exception 'bib number is below the category range';
  end if;
  if v_range_end is not null and new.bib_number > v_range_end then
    raise exception 'bib number is above the category range';
  end if;
  if v_category_prefix is not null and new.prefix is distinct from v_category_prefix then
    raise exception 'bib prefix must match the category prefix';
  end if;

  if new.registration_id is not null and not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and r.category_id = new.category_id
  ) then
    raise exception 'bib registration must match its event and category';
  end if;

  if new.status = 'active' and new.assignment_source is null then
    raise exception 'active bibs require an assignment source';
  end if;
  return new;
end;
$$;

create trigger bibs_scope_guard
  before insert or update on public.bibs
  for each row execute function public.validate_bib_scope();

create or replace function public.validate_race_kit_config_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.race_categories rc
    where rc.id = new.category_id and rc.event_id = new.event_id
  ) then
    raise exception 'race kit category must belong to its event';
  end if;
  return new;
end;
$$;

create trigger race_kit_configs_scope_guard
  before insert or update on public.race_kit_configs
  for each row execute function public.validate_race_kit_config_scope();

-- Allocate the next unused number in a configured category range. The
-- category row lock serializes allocators for the same category; the partial
-- active-number/code indexes remain the final duplicate guard.
create schema if not exists private;

create or replace function private.assign_next_bib(
  p_registration_id uuid,
  p_assigned_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_event_id uuid;
  v_category_id uuid;
  v_existing_bib_id uuid;
  v_prefix text;
  v_range_start integer;
  v_range_end integer;
  v_next_number integer;
  v_bib_id uuid;
begin
  if p_assigned_by is null then
    raise exception 'assigned_by is required';
  end if;

  select event_id, category_id, bib_id
    into v_event_id, v_category_id, v_existing_bib_id
  from public.registrations
  where id = p_registration_id
  for update;
  if not found then raise exception 'registration not found'; end if;
  if v_existing_bib_id is not null then
    raise exception 'registration already has an active bib';
  end if;

  select bib_prefix, bib_range_start, bib_range_end
    into v_prefix, v_range_start, v_range_end
  from public.race_categories
  where id = v_category_id
  for update;
  if not found or v_range_start is null or v_range_end is null then
    raise exception 'category must define a complete bib range';
  end if;
  if v_range_end < v_range_start then
    raise exception 'category bib range is invalid';
  end if;

  select s.series_number into v_next_number
  from generate_series(v_range_start, v_range_end) as s(series_number)
  where not exists (
    select 1 from public.bibs b
    where b.event_id = v_event_id
      and b.bib_number = s.series_number
      and b.status = 'active'
  )
  order by s.series_number
  limit 1;
  if v_next_number is null then raise exception 'no bibs remain in category range'; end if;

  insert into public.bibs (
    event_id, category_id, registration_id, bib_number, bib_code, prefix,
    status, assignment_source, assigned_by, assigned_at
  ) values (
    v_event_id, v_category_id, p_registration_id, v_next_number,
    coalesce(v_prefix, '') || v_next_number::text, v_prefix,
    'active', 'sequential', p_assigned_by, now()
  ) returning id into v_bib_id;
  return v_bib_id;
end;
$$;

revoke execute on function private.assign_next_bib(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.assign_next_bib(uuid, uuid) to service_role;

create or replace function public.validate_race_kit_claim()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and r.category_id = new.category_id
      and r.status = 'confirmed'
  ) then
    raise exception 'race kit claims require a confirmed matching registration';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.registration_id = new.registration_id
      and p.event_id = new.event_id
      and p.status = 'succeeded'
  ) then
    raise exception 'race kit claims require a succeeded payment';
  end if;

  if not exists (
    select 1 from public.bibs b
    where b.id = new.bib_id
      and b.event_id = new.event_id
      and b.category_id = new.category_id
      and b.registration_id = new.registration_id
      and b.status = 'active'
  ) then
    raise exception 'race kit claim bib must be the active bib for the registration';
  end if;

  if not exists (
    select 1 from public.race_kit_configs c
    where c.id = new.config_id
      and c.event_id = new.event_id
      and c.status = 'active'
      and (c.category_id is null or c.category_id = new.category_id)
  ) then
    raise exception 'race kit claim configuration does not match the event/category';
  end if;
  return new;
end;
$$;

create trigger race_kit_claims_state_guard
  before insert or update on public.race_kit_claims
  for each row execute function public.validate_race_kit_claim();

-- Keep the placeholder registration pointer synchronized with the active bib.
create or replace function public.sync_registration_bib_reference()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'active'
     and (new.status <> 'active' or new.registration_id is distinct from old.registration_id) then
    update public.registrations
    set bib_id = null, updated_at = now()
    where id = old.registration_id and bib_id = old.id;
  end if;

  if new.status = 'active' and new.registration_id is not null then
    update public.registrations
    set bib_id = new.id, updated_at = now()
    where id = new.registration_id;
  end if;
  return new;
end;
$$;

create trigger bibs_sync_registration_reference
  after insert or update of status, registration_id on public.bibs
  for each row execute function public.sync_registration_bib_reference();

create or replace function public.validate_registration_bib_reference()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.bib_id is not null and not exists (
    select 1 from public.bibs b
    where b.id = new.bib_id
      and b.registration_id = new.id
      and b.status = 'active'
  ) then
    raise exception 'registration bib must be its own active bib';
  end if;
  return new;
end;
$$;

create trigger registrations_bib_reference_guard
  before insert or update of bib_id on public.registrations
  for each row execute function public.validate_registration_bib_reference();

-- Reuse the existing payment-module timestamp trigger function.
create trigger bibs_set_updated_at
  before update on public.bibs
  for each row execute function public.set_payment_updated_at();
create trigger race_kit_configs_set_updated_at
  before update on public.race_kit_configs
  for each row execute function public.set_payment_updated_at();
create trigger race_kit_items_set_updated_at
  before update on public.race_kit_items
  for each row execute function public.set_payment_updated_at();
create trigger race_kit_claims_set_updated_at
  before update on public.race_kit_claims
  for each row execute function public.set_payment_updated_at();

-- ============================================================
-- RLS / PERMISSION-SCOPED ACCESS
-- ============================================================
alter table public.bibs enable row level security;
alter table public.race_kit_configs enable row level security;
alter table public.race_kit_items enable row level security;
alter table public.race_kit_claims enable row level security;

revoke all on public.bibs, public.race_kit_configs, public.race_kit_items,
  public.race_kit_claims from anon, authenticated;
grant select, insert, update, delete on public.bibs to authenticated;
grant select, insert, update, delete on public.race_kit_configs,
  public.race_kit_items to authenticated;
grant select, insert on public.race_kit_claims to authenticated;
grant all on public.bibs, public.race_kit_configs, public.race_kit_items,
  public.race_kit_claims to service_role;

-- Participants see only their own bibs, kit configurations, items, and claims.
create policy "Participants can view their own bibs"
  on public.bibs for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

create policy "Participants can view their own kit configurations"
  on public.race_kit_configs for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.user_id = (select auth.uid())
      and r.event_id = race_kit_configs.event_id
      and (race_kit_configs.category_id is null or race_kit_configs.category_id = r.category_id)
  ));

create policy "Participants can view their own kit items"
  on public.race_kit_items for select to authenticated
  using (exists (
    select 1
    from public.race_kit_configs c
    join public.registrations r on r.event_id = c.event_id
      and (c.category_id is null or c.category_id = r.category_id)
    where c.id = config_id and r.user_id = (select auth.uid())
  ));

create policy "Participants can view their own kit claims"
  on public.race_kit_claims for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

-- Bib management requires assign_bibs for an active organization member.
create policy "Bib managers can view organization bibs"
  on public.bibs for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = (select e.organization_id from public.events e where e.id = bibs.event_id)
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'assign_bibs'
  ));

create policy "Bib managers can create bibs"
  on public.bibs for insert to authenticated
  with check (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = bibs.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'assign_bibs'
      and (bibs.status <> 'active' or bibs.assigned_by = (select auth.uid()))
  ));

create policy "Bib managers can update bibs"
  on public.bibs for update to authenticated
  using (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = bibs.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'assign_bibs'
  ))
  with check (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = bibs.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'assign_bibs'
  ));

-- Kit configuration follows event-management permission; claims are separate.
create policy "Event managers can view kit configurations"
  on public.race_kit_configs for select to authenticated
  using (public.is_org_member((select e.organization_id from public.events e where e.id = event_id)));
create policy "Event managers can manage kit configurations"
  on public.race_kit_configs for all to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = race_kit_configs.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'edit_events'
  ))
  with check (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = race_kit_configs.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'edit_events'
  ));

create policy "Event managers can manage kit items"
  on public.race_kit_items for all to authenticated
  using (exists (
    select 1
    from public.race_kit_configs c
    join public.events e on e.id = c.event_id
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where c.id = config_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'edit_events'
  ))
  with check (exists (
    select 1
    from public.race_kit_configs c
    join public.events e on e.id = c.event_id
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where c.id = config_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'edit_events'
  ));

create policy "Kit staff can view organization claims"
  on public.race_kit_claims for select to authenticated
  using (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = race_kit_claims.event_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'scan_race_kits'
  ));

create policy "Kit staff can create organization claims"
  on public.race_kit_claims for insert to authenticated
  with check (
    claimed_by = (select auth.uid())
    and exists (
      select 1
      from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = race_kit_claims.event_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key = 'scan_race_kits'
    )
  );
