-- ============================================================
-- RaceDeck PH — Migration 001: Identity & Organizations
-- Spec §11 (org architecture), §14-16 (org profile/verification/roles), §65 (RLS)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── ENUMS ─────────────────────────────────────────────────
create type organization_account_status as enum ('active', 'suspended', 'deactivated');
create type organization_verification_status as enum ('draft', 'pending_review', 'needs_changes', 'approved', 'rejected');
create type organization_role as enum ('owner', 'event_manager', 'registration_staff', 'race_kit_staff', 'results_staff');

-- ── USER PROFILES ────────────────────────────────────────
-- Extends Supabase's built-in auth.users with app-specific profile data
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birthdate date,
  mobile text,
  address text,
  emergency_contact_name text,
  emergency_contact_number text,
  default_shirt_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- ── ORGANIZATIONS ────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  description text,
  contact_person text,
  contact_email text,
  contact_phone text,
  address text,
  website text,
  social_links jsonb default '{}'::jsonb,
  account_status organization_account_status not null default 'active',
  verification_status organization_verification_status not null default 'draft',
  verification_documents jsonb default '[]'::jsonb,
  payout_account jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ── ORGANIZATION MEMBERS ─────────────────────────────────
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role organization_role not null,
  is_active boolean not null default true,
  restricted_event_ids uuid[] default null, -- null = access to all events
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- ── PERMISSIONS (granular overrides on top of role presets) ─
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- e.g. 'manage_certificates', 'view_financials'
  description text
);

create table public.role_permissions (
  role organization_role not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role, permission_id)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- ============================================================
-- RLS POLICIES — Organization tenant isolation (Spec §11, §65)
-- ============================================================

-- Helper: is the current user an active member of this org?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

-- Helper: does the current user hold a specific role in this org?
create or replace function public.has_org_role(org_id uuid, required_role organization_role)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role = required_role
      and is_active = true
  );
$$;

-- Organizations: members can view their own org; anyone can view minimal public org info via a separate view (later)
create policy "Members can view their own organization"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "Owners can update their organization"
  on public.organizations for update
  using (public.has_org_role(id, 'owner'));

create policy "Authenticated users can create an organization"
  on public.organizations for insert
  with check (auth.uid() = created_by);

-- Organization members: visible only to other members of the same org
create policy "Members can view fellow members of their organization"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "Owners can manage members"
  on public.organization_members for all
  using (public.has_org_role(organization_id, 'owner'));

-- Permissions/role_permissions: readable by any authenticated user (reference data, not tenant-scoped)
create policy "Authenticated users can read permissions"
  on public.permissions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read role_permissions"
  on public.role_permissions for select
  using (auth.role() = 'authenticated');

-- ── SEED: default permissions ────────────────────────────
insert into public.permissions (key, description) values
  ('view_events', 'View events'),
  ('create_events', 'Create events'),
  ('edit_events', 'Edit events'),
  ('submit_events', 'Submit events for review'),
  ('manage_registrations', 'Manage registrations'),
  ('view_participants', 'View participant information'),
  ('manage_promo_codes', 'Manage promo codes'),
  ('assign_bibs', 'Assign bibs'),
  ('scan_race_kits', 'Scan/claim race kits'),
  ('manage_announcements', 'Manage announcements'),
  ('manage_email_reminders', 'Manage email reminders'),
  ('upload_results', 'Upload results'),
  ('publish_results', 'Publish results'),
  ('manage_certificates', 'Manage e-certificates'),
  ('view_reports', 'View reports'),
  ('view_financials', 'View financials'),
  ('manage_team', 'Manage team members');

-- Owner gets everything
insert into public.role_permissions (role, permission_id)
  select 'owner', id from public.permissions;