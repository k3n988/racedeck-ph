-- ============================================================
-- RaceDeck PH — Migration 002: Events Module
-- Spec §17-23 (event lifecycle/review separation, categories, capacity)
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────
create type event_lifecycle_status as enum ('draft', 'published', 'ongoing', 'completed', 'cancelled', 'archived');
create type event_review_status as enum ('not_submitted', 'pending_review', 'needs_changes', 'approved', 'rejected');
create type registration_availability_status as enum ('not_yet_open', 'open', 'closed', 'sold_out');

-- ── EVENTS ────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  slug text unique not null,
  description text,
  logo_url text,
  banner_url text,

  venue text,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),

  event_date date not null,
  start_time time,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,

  assembly_time time,
  gun_start_time time,
  cutoff_time time,

  overall_capacity integer,

  lifecycle_status event_lifecycle_status not null default 'draft',
  review_status event_review_status not null default 'not_submitted',
  review_feedback text,

  registration_availability registration_availability_status not null default 'not_yet_open',

  is_featured boolean not null default false,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- ── EVENT STATUS HISTORY (audit trail for lifecycle changes) ─
create table public.event_status_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  from_status event_lifecycle_status,
  to_status event_lifecycle_status not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.event_status_history enable row level security;

-- ── EVENT REVIEW HISTORY (organizer <-> RaceDeck admin review cycle) ─
create table public.event_review_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  from_status event_review_status,
  to_status event_review_status not null,
  feedback text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz not null default now()
);

alter table public.event_review_history enable row level security;

-- ── EVENT SCHEDULES (category-specific start times etc.) ────
create table public.event_schedules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,          -- e.g. "5K Gun Start"
  scheduled_at timestamptz not null,
  notes text
);

alter table public.event_schedules enable row level security;

-- ── EVENT ROUTES ──────────────────────────────────────────
create table public.event_routes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_label text,          -- optional: route may differ per category
  route_map_url text,
  starting_point text,
  finish_point text,
  description text
);

alter table public.event_routes enable row level security;

-- ── EVENT PARTNERS / SPONSORS ─────────────────────────────
create table public.event_partners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  logo_url text,
  partner_type text,            -- 'sponsor' | 'partner'
  display_order integer default 0
);

alter table public.event_partners enable row level security;

-- ── RACE CATEGORIES (§23) ─────────────────────────────────
create table public.race_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,

  name text not null,           -- '5K', '10K', 'Custom'
  distance_km numeric(6,2),
  registration_fee numeric(10,2) not null default 0,

  max_slots integer,
  confirmed_count integer not null default 0, -- maintained by trigger/service, not trusted client-side

  bib_prefix text,
  bib_range_start integer,
  bib_range_end integer,

  gun_start_time time,
  cutoff_time time,

  registration_availability registration_availability_status not null default 'not_yet_open',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.race_categories enable row level security;

create index idx_events_org on public.events(organization_id);
create index idx_events_lifecycle on public.events(lifecycle_status);
create index idx_race_categories_event on public.race_categories(event_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Public can view events that are Published/Ongoing/Completed AND review-approved
create policy "Public can view published approved events"
  on public.events for select
  using (
    lifecycle_status in ('published', 'ongoing', 'completed')
    and review_status = 'approved'
  );

-- Org members can always view their own org's events regardless of status
create policy "Org members can view their own events"
  on public.events for select
  using (public.is_org_member(organization_id));

create policy "Org members with create_events can insert"
  on public.events for insert
  with check (public.is_org_member(organization_id));

create policy "Org members with edit_events can update"
  on public.events for update
  using (public.is_org_member(organization_id));

-- Categories inherit event visibility: public sees categories of visible events
create policy "Public can view categories of visible events"
  on public.race_categories for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.lifecycle_status in ('published', 'ongoing', 'completed')
        and e.review_status = 'approved'
    )
  );

create policy "Org members can view their own event categories"
  on public.race_categories for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.organization_id)
    )
  );

create policy "Org members can manage their own event categories"
  on public.race_categories for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.organization_id)
    )
  );

-- Schedules, routes, partners: same pattern (public read if event visible, org manage if member)
create policy "Public can view schedules of visible events"
  on public.event_schedules for select
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.lifecycle_status in ('published','ongoing','completed') and e.review_status = 'approved'
  ));

create policy "Org members manage their event schedules"
  on public.event_schedules for all
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

create policy "Public can view routes of visible events"
  on public.event_routes for select
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.lifecycle_status in ('published','ongoing','completed') and e.review_status = 'approved'
  ));

create policy "Org members manage their event routes"
  on public.event_routes for all
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

create policy "Public can view partners of visible events"
  on public.event_partners for select
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.lifecycle_status in ('published','ongoing','completed') and e.review_status = 'approved'
  ));

create policy "Org members manage their event partners"
  on public.event_partners for all
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

-- Status/review history: org members can view; only RaceDeck admin (service role) writes review history
create policy "Org members can view their event status history"
  on public.event_status_history for select
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));

create policy "Org members can view their event review history"
  on public.event_review_history for select
  using (exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  ));