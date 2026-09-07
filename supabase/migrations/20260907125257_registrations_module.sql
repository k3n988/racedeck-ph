-- ============================================================
-- RaceDeck PH — Migration 003: Registrations, Slot Holds, Form Builder
-- Spec §24 (temporary slot reservation), §25 (form builder),
--      §26-27 (registrations + status), §28 (activity history)
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────
create type registration_status as enum (
  'pending_payment', 'confirmed', 'cancelled', 'transferred', 'refunded', 'expired'
);

create type slot_hold_status as enum ('active', 'expired', 'converted', 'released');

create type custom_field_type as enum (
  'short_text', 'long_text', 'dropdown', 'radio', 'checkbox', 'yes_no'
);

-- ── EVENT REGISTRATION FORM FIELDS (§25) ─────────────────
create table public.event_registration_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  field_type custom_field_type not null,
  label text not null,
  is_required boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_registration_fields enable row level security;

create table public.event_registration_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.event_registration_fields(id) on delete cascade,
  label text not null,
  value text not null,
  display_order integer not null default 0
);

alter table public.event_registration_field_options enable row level security;

-- ── TEMPORARY SLOT RESERVATION (§24) ──────────────────────
create table public.registration_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid not null references public.race_categories(id) on delete cascade,
  user_id uuid references auth.users(id),
  session_id text, -- fallback for guest checkout before account creation
  status slot_hold_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.registration_holds enable row level security;

create index idx_holds_category_active on public.registration_holds(category_id) where status = 'active';
create index idx_holds_expires on public.registration_holds(expires_at) where status = 'active';

-- ── REGISTRATIONS (§26-27) ────────────────────────────────
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  registration_number text unique not null, -- e.g. REG-2027-005423
  event_id uuid not null references public.events(id) on delete restrict,
  category_id uuid not null references public.race_categories(id) on delete restrict,
  user_id uuid references auth.users(id),
  hold_id uuid references public.registration_holds(id),

  status registration_status not null default 'pending_payment',

  -- participant info snapshot at time of registration (may differ from live profile)
  first_name text not null,
  last_name text not null,
  birthdate date,
  email text not null,
  mobile text,
  address text,
  emergency_contact_name text,
  emergency_contact_number text,
  shirt_size text,
  competition_classification text,

  promo_code_id uuid, -- FK added in promo migration
  bib_id uuid,         -- FK added in race-ops migration

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registrations enable row level security;

create index idx_registrations_event on public.registrations(event_id);
create index idx_registrations_category on public.registrations(category_id);
create index idx_registrations_user on public.registrations(user_id);
create index idx_registrations_status on public.registrations(status);

-- ── REGISTRATION RESPONSES (answers to custom fields) ─────
create table public.registration_responses (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  field_id uuid not null references public.event_registration_fields(id) on delete cascade,
  value text
);

alter table public.registration_responses enable row level security;

-- ── REGISTRATION STATUS HISTORY (§27 transitions) ─────────
create table public.registration_status_history (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  from_status registration_status,
  to_status registration_status not null,
  reason text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.registration_status_history enable row level security;

-- ── REGISTRATION ACTIVITY LOG (§28 — broader than status alone) ─
create table public.registration_activity (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  action text not null, -- 'created','slot_reserved','payment_initiated','payment_confirmed','bib_assigned','qr_scanned','kit_claimed','refund_processed','result_published', etc.
  actor uuid references auth.users(id),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.registration_activity enable row level security;
create index idx_activity_registration on public.registration_activity(registration_id);

-- ============================================================
-- CAPACITY-SAFE CONFIRMATION LOGIC (prevents overselling, §23/§24)
-- ============================================================

-- Atomically confirms a registration only if category capacity allows it.
-- Uses row-level lock on the category row to serialize concurrent confirmations.
create or replace function public.confirm_registration(p_registration_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_category_id uuid;
  v_max_slots integer;
  v_confirmed_count integer;
  v_current_status registration_status;
begin
  select category_id, status into v_category_id, v_current_status
  from public.registrations
  where id = p_registration_id
  for update;

  if v_current_status = 'confirmed' then
    return true; -- already confirmed, idempotent
  end if;

  -- lock the category row to prevent race conditions across concurrent webhooks
  select max_slots, confirmed_count into v_max_slots, v_confirmed_count
  from public.race_categories
  where id = v_category_id
  for update;

  if v_max_slots is not null and v_confirmed_count >= v_max_slots then
    return false; -- capacity full, do not confirm
  end if;

  update public.registrations
  set status = 'confirmed', updated_at = now()
  where id = p_registration_id;

  update public.race_categories
  set confirmed_count = confirmed_count + 1,
      registration_availability = case
        when max_slots is not null and confirmed_count + 1 >= max_slots then 'sold_out'::registration_availability_status
        else registration_availability
      end
  where id = v_category_id;

  insert into public.registration_status_history (registration_id, from_status, to_status)
  values (p_registration_id, v_current_status, 'confirmed');

  insert into public.registration_activity (registration_id, action)
  values (p_registration_id, 'payment_confirmed');

  return true;
end;
$$;

-- Decrement confirmed_count when a confirmed registration is cancelled/refunded/transferred away
create or replace function public.release_registration_slot(p_registration_id uuid, p_new_status registration_status)
returns void
language plpgsql
security definer
as $$
declare
  v_category_id uuid;
  v_current_status registration_status;
begin
  select category_id, status into v_category_id, v_current_status
  from public.registrations
  where id = p_registration_id
  for update;

  update public.registrations
  set status = p_new_status, updated_at = now()
  where id = p_registration_id;

  if v_current_status = 'confirmed' then
    update public.race_categories
    set confirmed_count = greatest(confirmed_count - 1, 0),
        registration_availability = case
          when registration_availability = 'sold_out' then 'open'::registration_availability_status
          else registration_availability
        end
    where id = v_category_id;
  end if;

  insert into public.registration_status_history (registration_id, from_status, to_status)
  values (p_registration_id, v_current_status, p_new_status);
end;
$$;

-- Expire stale holds (called by a cron job — app/api/cron/hold-expiry)
create or replace function public.expire_stale_holds()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  update public.registration_holds
  set status = 'expired'
  where status = 'active' and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Registration form fields: public can view active fields of visible events; org manages their own
create policy "Public can view active fields of visible events"
  on public.event_registration_fields for select
  using (
    is_active = true and exists (
      select 1 from public.events e
      where e.id = event_id and e.lifecycle_status in ('published','ongoing','completed') and e.review_status = 'approved'
    )
  );

create policy "Org members manage their event fields"
  on public.event_registration_fields for all
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

create policy "Public can view field options of visible fields"
  on public.event_registration_field_options for select
  using (exists (
    select 1 from public.event_registration_fields f
    join public.events e on e.id = f.event_id
    where f.id = field_id and e.lifecycle_status in ('published','ongoing','completed') and e.review_status = 'approved'
  ));

create policy "Org members manage their field options"
  on public.event_registration_field_options for all
  using (exists (
    select 1 from public.event_registration_fields f
    join public.events e on e.id = f.event_id
    where f.id = field_id and public.is_org_member(e.organization_id)
  ));

-- Registration holds: only the owning user (or session) can see/create their own hold
create policy "Users can view their own holds"
  on public.registration_holds for select
  using (auth.uid() = user_id);

create policy "Users can create their own holds"
  on public.registration_holds for insert
  with check (auth.uid() = user_id or user_id is null);

-- Registrations: participant sees their own; org members see registrations for their org's events
create policy "Participants can view their own registrations"
  on public.registrations for select
  using (auth.uid() = user_id);

create policy "Org members can view registrations for their events"
  on public.registrations for select
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

create policy "Users can create their own registrations"
  on public.registrations for insert
  with check (auth.uid() = user_id);

create policy "Org members can update registrations for their events"
  on public.registrations for update
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

-- Responses: same visibility as parent registration
create policy "Participants view their own responses"
  on public.registration_responses for select
  using (exists (
    select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid()
  ));

create policy "Org members view responses for their events"
  on public.registration_responses for select
  using (exists (
    select 1 from public.registrations r
    join public.events e on e.id = r.event_id
    where r.id = registration_id and public.is_org_member(e.organization_id)
  ));

create policy "Users insert their own responses"
  on public.registration_responses for insert
  with check (exists (
    select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid()
  ));

-- Status history & activity: same visibility pattern
create policy "Participants view their own status history"
  on public.registration_status_history for select
  using (exists (
    select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid()
  ));

create policy "Org members view status history for their events"
  on public.registration_status_history for select
  using (exists (
    select 1 from public.registrations r
    join public.events e on e.id = r.event_id
    where r.id = registration_id and public.is_org_member(e.organization_id)
  ));

create policy "Participants view their own activity"
  on public.registration_activity for select
  using (exists (
    select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid()
  ));

create policy "Org members view activity for their events"
  on public.registration_activity for select
  using (exists (
    select 1 from public.registrations r
    join public.events e on e.id = r.event_id
    where r.id = registration_id and public.is_org_member(e.organization_id)
  ));