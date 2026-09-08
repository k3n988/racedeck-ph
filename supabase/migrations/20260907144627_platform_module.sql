-- RaceDeck Platform module
-- Support, audit, and platform content are separate concerns. This migration
-- stores the database foundation only; staff workflows and admin authorization
-- remain in trusted server-side services.

create type support_case_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type support_case_type as enum (
  'general_account', 'event', 'registration', 'payment', 'refund', 'race_kit'
);
create type support_case_priority as enum ('low', 'normal', 'high', 'urgent');
create type platform_content_type as enum (
  'featured_race', 'homepage_banner', 'homepage_section', 'platform_announcement'
);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_organization_id uuid references public.organizations(id) on delete restrict,
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  case_type support_case_type not null,
  subject text not null,
  description text not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict,
  registration_id uuid references public.registrations(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  refund_id uuid references public.refunds(id) on delete restrict,
  status support_case_status not null default 'open',
  priority support_case_priority not null default 'normal',
  resolution_notes text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_cases_reference_not_blank check (btrim(case_reference) <> ''),
  constraint support_cases_subject_not_blank check (btrim(subject) <> ''),
  constraint support_cases_description_not_blank check (btrim(description) <> ''),
  constraint support_cases_resolution_not_blank check (
    resolution_notes is null or btrim(resolution_notes) <> ''
  ),
  constraint support_cases_timeline check (
    (status in ('open', 'in_progress') and resolved_at is null and closed_at is null)
    or (status = 'resolved' and resolved_at is not null and closed_at is null)
    or (status = 'closed' and resolved_at is not null and closed_at is not null)
  ),
  constraint support_cases_close_after_resolve check (
    closed_at is null or resolved_at is not null and closed_at >= resolved_at
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role_context text,
  organization_id uuid references public.organizations(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  previous_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_resource_type_not_blank check (btrim(resource_type) <> ''),
  constraint audit_logs_resource_type_allowed check (resource_type in (
    'organization', 'event', 'registration', 'payment', 'refund', 'payout',
    'bib', 'race_kit_claim', 'result', 'result_batch', 'certificate',
    'legal_document', 'event_waiver', 'role_permission', 'platform_setting',
    'communication', 'support_case', 'content_block'
  )),
  constraint audit_logs_snapshots_are_objects check (
    (previous_values is null or jsonb_typeof(previous_values) in ('object', 'array'))
    and (new_values is null or jsonb_typeof(new_values) in ('object', 'array'))
  )
);

create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  content_type platform_content_type not null,
  title text not null,
  body text,
  media_reference text,
  event_id uuid references public.events(id) on delete set null,
  configuration jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_active boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_blocks_key_not_blank check (btrim(content_key) <> ''),
  constraint content_blocks_title_not_blank check (btrim(title) <> ''),
  constraint content_blocks_display_order_nonnegative check (display_order >= 0),
  constraint content_blocks_content_present check (
    (body is not null and btrim(body) <> '')
    or (media_reference is not null and btrim(media_reference) <> '')
    or configuration <> '{}'::jsonb
  ),
  constraint content_blocks_featured_event check (
    (content_type = 'featured_race' and event_id is not null)
    or (content_type <> 'featured_race' and event_id is null)
  ),
  constraint content_blocks_publication_metadata check (
    (not is_published and published_at is null and published_by is null)
    or (is_published and published_at is not null and published_by is not null)
  )
);

create index support_cases_requester_idx on public.support_cases (requester_user_id, created_at desc);
create index support_cases_organization_idx on public.support_cases (organization_id, created_at desc);
create index support_cases_assigned_staff_idx on public.support_cases (assigned_staff_user_id, status);
create index support_cases_status_idx on public.support_cases (status, created_at desc);
create index support_cases_event_idx on public.support_cases (event_id);
create index support_cases_registration_idx on public.support_cases (registration_id);
create index support_cases_payment_idx on public.support_cases (payment_id);
create index support_cases_refund_idx on public.support_cases (refund_id);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_organization_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_event_idx on public.audit_logs (event_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index content_blocks_type_state_idx
  on public.content_blocks (content_type, is_published, is_active, display_order);
create index content_blocks_event_idx on public.content_blocks (event_id);
create index content_blocks_published_at_idx on public.content_blocks (published_at desc);

create or replace function private.validate_support_case_scope()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.requester_organization_id is not null and not exists (
    select 1 from public.organization_members om
    where om.organization_id = new.requester_organization_id
      and om.user_id = new.requester_user_id
      and om.is_active = true
  ) then
    raise exception 'Requester organization does not belong to requester';
  end if;
  if new.event_id is not null then
    if not exists (select 1 from public.events e
      where e.id = new.event_id and (new.organization_id is null or e.organization_id = new.organization_id)) then
      raise exception 'Support case event does not belong to organization';
    end if;
  end if;
  if new.registration_id is not null then
    if not exists (select 1 from public.registrations r
      where r.id = new.registration_id and r.event_id = new.event_id) then
      raise exception 'Support case registration does not belong to event';
    end if;
  end if;
  if new.payment_id is not null then
    if not exists (select 1 from public.payments p
      where p.id = new.payment_id and p.registration_id = new.registration_id
        and p.event_id = new.event_id and p.organization_id = new.organization_id) then
      raise exception 'Support case payment does not match references';
    end if;
  end if;
  if new.refund_id is not null then
    if not exists (select 1 from public.refunds f
      where f.id = new.refund_id and f.registration_id = new.registration_id
        and f.event_id = new.event_id and f.organization_id = new.organization_id) then
      raise exception 'Support case refund does not match references';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.requester_user_id <> old.requester_user_id
    or new.requester_organization_id is distinct from old.requester_organization_id
    or new.organization_id is distinct from old.organization_id
    or new.event_id is distinct from old.event_id
    or new.registration_id is distinct from old.registration_id
    or new.payment_id is distinct from old.payment_id
    or new.refund_id is distinct from old.refund_id
  ) then
    raise exception 'Support case identity and associations are immutable';
  end if;
  if tg_op = 'UPDATE' and old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Closed support cases cannot be reopened';
  end if;
  return new;
end;
$$;

create or replace function private.validate_content_block()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.is_published and not new.is_active then
    raise exception 'Published content blocks must be active';
  end if;
  if new.content_type = 'featured_race' and not exists (
    select 1 from public.events e where e.id = new.event_id
  ) then
    raise exception 'Featured race content requires an existing event';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_immutable_platform_record_mutation()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  raise exception 'Platform audit records are immutable';
end;
$$;

create trigger support_cases_validate_trigger
  before insert or update on public.support_cases
  for each row execute function private.validate_support_case_scope();
create trigger content_blocks_validate_trigger
  before insert or update on public.content_blocks
  for each row execute function private.validate_content_block();
create trigger support_cases_updated_at_trigger
  before update on public.support_cases
  for each row execute function public.set_payment_updated_at();
create trigger content_blocks_updated_at_trigger
  before update on public.content_blocks
  for each row execute function public.set_payment_updated_at();
create trigger audit_logs_immutable_trigger
  before update or delete on public.audit_logs
  for each row execute function private.prevent_immutable_platform_record_mutation();

alter table public.support_cases enable row level security;
alter table public.audit_logs enable row level security;
alter table public.content_blocks enable row level security;

create policy "Users can view their own support cases"
  on public.support_cases for select to authenticated
  using (requester_user_id = (select auth.uid()));
create policy "Users can create their own support cases"
  on public.support_cases for insert to authenticated
  with check (requester_user_id = (select auth.uid()));
create policy "Organization participant viewers can view support cases"
  on public.support_cases for select to authenticated
  using (organization_id is not null and exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = support_cases.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'view_participants'
  ));

create policy "Anyone can view published active content blocks"
  on public.content_blocks for select to anon, authenticated
  using (is_active = true and is_published = true);

revoke all on public.support_cases, public.audit_logs, public.content_blocks
  from public, anon, authenticated;
grant select, insert on public.support_cases to authenticated;
grant select on public.content_blocks to anon, authenticated;
grant all on public.support_cases, public.audit_logs, public.content_blocks to service_role;
