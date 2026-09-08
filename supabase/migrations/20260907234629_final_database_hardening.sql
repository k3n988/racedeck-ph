-- RaceDeck final database hardening
-- This migration contains only corrective controls identified by the production
-- audit. It does not recreate or alter historical migrations.

create schema if not exists private;

-- ============================================================
-- DATABASE-BACKED INTERNAL RBAC
-- ============================================================
create type public.racedeck_internal_role as enum
  ('super_admin', 'admin', 'finance', 'support');

create table public.organization_roles (
  role public.organization_role primary key,
  display_name text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint organization_roles_display_name_not_blank
    check (btrim(display_name) <> '')
);

insert into public.organization_roles (role, display_name, description)
values
  ('owner', 'Organizer Owner', 'Full organization access'),
  ('event_manager', 'Event Manager', 'Event and event-configuration access'),
  ('registration_staff', 'Registration Staff', 'Registration and participant operations'),
  ('race_kit_staff', 'Race Kit Staff', 'Bib and race-kit operations'),
  ('results_staff', 'Results Staff', 'Result import and publication operations')
on conflict (role) do update
set display_name = excluded.display_name,
    description = excluded.description;

create table public.racedeck_internal_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.racedeck_internal_role not null,
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.internal_role_permissions (
  role public.racedeck_internal_role not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role, permission_id)
);

insert into public.permissions (key, description)
values
  ('manage_organizer_verifications', 'Review organizer verification submissions'),
  ('manage_payout_accounts', 'Manage organization payout account references'),
  ('manage_support_cases', 'Manage platform support cases'),
  ('view_audit_logs', 'View platform audit logs'),
  ('manage_platform_content', 'Manage published platform content'),
  ('manage_internal_roles', 'Manage RaceDeck internal roles')
on conflict (key) do nothing;

insert into public.internal_role_permissions (role, permission_id)
select r.role, p.id
from (values
  ('super_admin'::public.racedeck_internal_role, 'manage_organizer_verifications'),
  ('super_admin'::public.racedeck_internal_role, 'manage_payout_accounts'),
  ('super_admin'::public.racedeck_internal_role, 'manage_support_cases'),
  ('super_admin'::public.racedeck_internal_role, 'view_audit_logs'),
  ('super_admin'::public.racedeck_internal_role, 'manage_platform_content'),
  ('super_admin'::public.racedeck_internal_role, 'manage_internal_roles'),
  ('admin'::public.racedeck_internal_role, 'manage_organizer_verifications'),
  ('admin'::public.racedeck_internal_role, 'manage_support_cases'),
  ('admin'::public.racedeck_internal_role, 'view_audit_logs'),
  ('finance'::public.racedeck_internal_role, 'manage_payout_accounts'),
  ('finance'::public.racedeck_internal_role, 'view_audit_logs'),
  ('support'::public.racedeck_internal_role, 'manage_support_cases')
) as r(role, permission_key)
join public.permissions p on p.key = r.permission_key
on conflict do nothing;

create index racedeck_internal_roles_active_idx
  on public.racedeck_internal_user_roles (user_id, role)
  where is_active;

create or replace function private.has_internal_role(
  p_role public.racedeck_internal_role
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.racedeck_internal_user_roles r
    where r.user_id = (select auth.uid())
      and r.role = p_role
      and r.is_active
  );
$$;

create or replace function private.has_any_internal_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = (select auth.uid()) and r.is_active
  );
$$;

create or replace function private.has_org_permission(
  p_organization_id uuid,
  p_permission_key text,
  p_event_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (private.has_internal_role('admin') or private.has_internal_role('super_admin'))
    or exists (
      select 1
      from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where om.organization_id = p_organization_id
        and om.user_id = (select auth.uid())
        and om.is_active
        and p.key = p_permission_key
        and (
          p_event_id is null
          or om.restricted_event_ids is null
          or p_event_id = any(om.restricted_event_ids)
        )
    );
$$;

create or replace function private.is_org_member_hardened(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.is_active
  );
$$;

revoke all on function private.has_internal_role(public.racedeck_internal_role) from public, anon, authenticated;
revoke all on function private.has_any_internal_role() from public, anon, authenticated;
revoke all on function private.has_org_permission(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.is_org_member_hardened(uuid) from public, anon, authenticated;
grant execute on function private.has_internal_role(public.racedeck_internal_role) to authenticated;
grant execute on function private.has_any_internal_role() to authenticated;
grant execute on function private.has_org_permission(uuid, text, uuid) to authenticated;
grant execute on function private.is_org_member_hardened(uuid) to authenticated;

alter table public.organization_roles enable row level security;
alter table public.racedeck_internal_user_roles enable row level security;
alter table public.internal_role_permissions enable row level security;

revoke all on public.organization_roles, public.racedeck_internal_user_roles,
  public.internal_role_permissions from anon, authenticated;
grant select on public.organization_roles to authenticated;
grant select on public.internal_role_permissions to authenticated;
grant all on public.organization_roles, public.racedeck_internal_user_roles,
  public.internal_role_permissions to service_role;

create policy organization_roles_authenticated_read
  on public.organization_roles for select to authenticated
  using (true);
create policy internal_role_permissions_authenticated_read
  on public.internal_role_permissions for select to authenticated
  using (true);
create policy internal_roles_self_read
  on public.racedeck_internal_user_roles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy internal_roles_admin_read
  on public.racedeck_internal_user_roles for select to authenticated
  using (private.has_internal_role('super_admin'));

-- ============================================================
-- ORGANIZER VERIFICATION AND PAYOUT ACCOUNT REFERENCES
-- ============================================================
create type public.organizer_verification_status as enum
  ('draft', 'pending_review', 'needs_changes', 'approved', 'rejected');

create table public.organizer_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  status public.organizer_verification_status not null default 'draft',
  legal_name text,
  business_name text,
  registration_number text,
  document_storage_references jsonb not null default '[]'::jsonb,
  reviewer_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizer_verifications_documents_array
    check (jsonb_typeof(document_storage_references) = 'array'),
  constraint organizer_verifications_timestamps check (
    (status = 'draft' and submitted_at is null)
    or (status <> 'draft' and submitted_at is not null)
  )
);

create table public.organization_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null,
  account_reference text not null,
  account_label text,
  currency text not null default 'PHP',
  is_default boolean not null default false,
  is_active boolean not null default true,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_accounts_provider_not_blank check (btrim(provider) <> ''),
  constraint payout_accounts_reference_not_blank check (btrim(account_reference) <> ''),
  constraint payout_accounts_currency_iso check (currency ~ '^[A-Z]{3}$'),
  unique (organization_id, provider, account_reference)
);

create unique index organization_default_payout_account_uidx
  on public.organization_payout_accounts (organization_id)
  where is_default and is_active;
create index organizer_verifications_status_idx
  on public.organizer_verifications (status, updated_at desc);
create index payout_accounts_organization_idx
  on public.organization_payout_accounts (organization_id, is_active);

alter table public.organizer_verifications enable row level security;
alter table public.organization_payout_accounts enable row level security;
revoke all on public.organizer_verifications, public.organization_payout_accounts from anon, authenticated;
grant select on public.organizer_verifications, public.organization_payout_accounts to authenticated;
grant all on public.organizer_verifications, public.organization_payout_accounts to service_role;

create policy organizer_verifications_owner_read
  on public.organizer_verifications for select to authenticated
  using (private.has_org_permission(organization_id, 'view_events'));
create policy organizer_verifications_internal_read
  on public.organizer_verifications for select to authenticated
  using (private.has_internal_role('admin') or private.has_internal_role('super_admin'));
create policy payout_accounts_finance_read
  on public.organization_payout_accounts for select to authenticated
  using (private.has_org_permission(organization_id, 'view_financials')
    or private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin'));

create policy payouts_internal_finance_read
  on public.payouts for select to authenticated
  using (private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin'));
create policy reconciliation_internal_finance_read
  on public.finance_reconciliation_records for select to authenticated
  using (private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin'));
create policy support_cases_internal_read
  on public.support_cases for select to authenticated
  using (private.has_internal_role('support')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin'));
create policy audit_logs_internal_read
  on public.audit_logs for select to authenticated
  using (private.has_internal_role('admin')
    or private.has_internal_role('super_admin')
    or private.has_internal_role('finance'));

-- ============================================================
-- HARDEN EXISTING ORGANIZATION POLICIES
-- ============================================================
-- Restrictive policies compose with existing historical policies and therefore
-- prevent a broad legacy membership policy from bypassing event restrictions.
create policy events_hardened_scope
  on public.events as restrictive for all to authenticated
  using (
    (lifecycle_status in ('published', 'ongoing', 'completed') and review_status = 'approved')
    or private.has_org_permission(organization_id, 'view_events', id)
    or private.has_org_permission(organization_id, 'edit_events', id)
    or private.has_org_permission(organization_id, 'create_events', id)
    or private.has_org_permission(organization_id, 'manage_registrations', id)
    or private.has_org_permission(organization_id, 'view_participants', id)
  )
  with check (
    private.has_org_permission(organization_id, 'create_events', id)
    or private.has_org_permission(organization_id, 'edit_events', id)
  );

-- Apply the same tenant and permission boundary to event-owned child rows.
create policy event_schedules_hardened_scope
  on public.event_schedules as restrictive for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id))
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id
      and private.has_org_permission(e.organization_id, 'edit_events', e.id)
  ));

create policy event_routes_hardened_scope
  on public.event_routes as restrictive for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id))
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id
      and private.has_org_permission(e.organization_id, 'edit_events', e.id)
  ));

create policy event_partners_hardened_scope
  on public.event_partners as restrictive for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id))
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id
      and private.has_org_permission(e.organization_id, 'edit_events', e.id)
  ));

create policy race_categories_hardened_scope
  on public.race_categories as restrictive for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id))
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id
      and private.has_org_permission(e.organization_id, 'edit_events', e.id)
  ));

create policy registration_fields_hardened_scope
  on public.event_registration_fields as restrictive for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id)
        or private.has_org_permission(e.organization_id, 'manage_registrations', e.id))
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id
      and private.has_org_permission(e.organization_id, 'manage_registrations', e.id)
  ));

create policy registration_options_hardened_scope
  on public.event_registration_field_options as restrictive for all to authenticated
  using (exists (
    select 1 from public.event_registration_fields f
    join public.events e on e.id = f.event_id
    where f.id = field_id
      and ((e.lifecycle_status in ('published', 'ongoing', 'completed') and e.review_status = 'approved')
        or private.has_org_permission(e.organization_id, 'view_events', e.id)
        or private.has_org_permission(e.organization_id, 'manage_registrations', e.id))
  ))
  with check (exists (
    select 1 from public.event_registration_fields f
    join public.events e on e.id = f.event_id
    where f.id = field_id
      and private.has_org_permission(e.organization_id, 'manage_registrations', e.id)
  ));

create policy registrations_hardened_scope
  on public.registrations as restrictive for all to authenticated
  using (
    (select auth.uid()) = user_id
    or private.has_org_permission(
      (select e.organization_id from public.events e where e.id = event_id),
      'manage_registrations', event_id
    )
    or private.has_org_permission(
      (select e.organization_id from public.events e where e.id = event_id),
      'view_participants', event_id
    )
  )
  with check (
    (select auth.uid()) = user_id
    or private.has_org_permission(
      (select e.organization_id from public.events e where e.id = event_id),
      'manage_registrations', event_id
    )
  );

create policy payments_hardened_scope
  on public.payments as restrictive for all to authenticated
  using (
    (select r.user_id from public.registrations r where r.id = registration_id) = (select auth.uid())
    or private.has_org_permission(organization_id, 'view_financials', event_id)
    or private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin')
  )
  with check (false);

create policy payment_transactions_hardened_scope
  on public.payment_transactions as restrictive for all to authenticated
  using (
    (select r.user_id from public.registrations r where r.id = registration_id) = (select auth.uid())
    or private.has_org_permission(organization_id, 'view_financials', event_id)
    or private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin')
  )
  with check (false);

create policy refunds_hardened_scope
  on public.refunds as restrictive for all to authenticated
  using (
    (select r.user_id from public.registrations r where r.id = registration_id) = (select auth.uid())
    or private.has_org_permission(organization_id, 'view_financials', event_id)
    or private.has_internal_role('finance')
    or private.has_internal_role('admin')
    or private.has_internal_role('super_admin')
  )
  with check (false);

create policy registration_responses_hardened_scope
  on public.registration_responses as restrictive for all to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and ((select auth.uid()) = r.user_id
        or private.has_org_permission(
          (select e.organization_id from public.events e where e.id = r.event_id),
          'view_participants', r.event_id))
  ))
  with check (exists (
    select 1 from public.registrations r where r.id = registration_id
      and (select auth.uid()) = r.user_id
  ));

create policy registration_history_hardened_scope
  on public.registration_status_history as restrictive for all to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and private.has_org_permission(
        (select e.organization_id from public.events e where e.id = r.event_id),
        'view_participants', r.event_id)
  ))
  with check (false);

create policy registration_activity_hardened_scope
  on public.registration_activity as restrictive for all to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and ((select auth.uid()) = r.user_id
        or private.has_org_permission(
          (select e.organization_id from public.events e where e.id = r.event_id),
          'view_participants', r.event_id))
  ))
  with check (false);

-- Replace the two deprecated initial policies with role-targeted policies.
drop policy if exists "Authenticated users can read permissions" on public.permissions;
drop policy if exists "Authenticated users can read role_permissions" on public.role_permissions;
create policy permissions_authenticated_read
  on public.permissions for select to authenticated using (true);
create policy role_permissions_authenticated_read
  on public.role_permissions for select to authenticated using (true);

-- ============================================================
-- CROSS-ENTITY OWNERSHIP INTEGRITY
-- ============================================================
create or replace function private.validate_registration_event_category()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.race_categories c
    where c.id = new.category_id and c.event_id = new.event_id
  ) then
    raise exception 'registration category does not belong to registration event';
  end if;
  return new;
end;
$$;

create or replace function private.validate_payment_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.registrations r
    join public.events e on e.id = r.event_id
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and e.organization_id = new.organization_id
  ) then
    raise exception 'payment ownership scope is inconsistent';
  end if;
  return new;
end;
$$;

create or replace function private.validate_transaction_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id
      and p.registration_id = new.registration_id
      and p.event_id = new.event_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'payment transaction ownership scope is inconsistent';
  end if;
  return new;
end;
$$;

create or replace function private.validate_document_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id
      and p.registration_id = new.registration_id
      and p.event_id = new.event_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'document ownership scope is inconsistent';
  end if;
  return new;
end;
$$;

create or replace function private.validate_bib_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.registration_id is not null and not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and r.category_id = new.category_id
  ) then
    raise exception 'bib ownership scope is inconsistent';
  end if;
  return new;
end;
$$;

create or replace function private.validate_result_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.registration_id is not null and not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and r.category_id = new.race_category_id
  ) then
    raise exception 'result ownership scope is inconsistent';
  end if;
  if new.bib_id is not null and not exists (
    select 1 from public.bibs b where b.id = new.bib_id and b.event_id = new.event_id
  ) then
    raise exception 'result bib does not belong to result event';
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_scope_hardening on public.registrations;
create trigger registrations_scope_hardening
  before insert or update on public.registrations
  for each row execute function private.validate_registration_event_category();

drop trigger if exists payments_scope_hardening on public.payments;
create trigger payments_scope_hardening
  before insert or update on public.payments
  for each row execute function private.validate_payment_scope();

drop trigger if exists payment_transactions_scope_hardening on public.payment_transactions;
create trigger payment_transactions_scope_hardening
  before insert or update on public.payment_transactions
  for each row execute function private.validate_transaction_scope();

drop trigger if exists payment_receipts_scope_hardening on public.payment_receipts;
create trigger payment_receipts_scope_hardening
  before insert or update on public.payment_receipts
  for each row execute function private.validate_document_scope();

drop trigger if exists invoices_scope_hardening on public.invoices;
create trigger invoices_scope_hardening
  before insert or update on public.invoices
  for each row execute function private.validate_document_scope();

create trigger refunds_scope_hardening
  before insert or update on public.refunds
  for each row execute function private.validate_payment_scope();

create trigger platform_fees_scope_hardening
  before insert or update on public.platform_fees
  for each row execute function private.validate_payment_scope();

drop trigger if exists bibs_scope_hardening on public.bibs;
create trigger bibs_scope_hardening
  before insert or update on public.bibs
  for each row execute function private.validate_bib_scope();

drop trigger if exists results_scope_hardening on public.results;
create trigger results_scope_hardening
  before insert or update on public.results
  for each row execute function private.validate_result_scope();

-- ============================================================
-- CAPACITY, HOLD, AND FINANCIAL HISTORY PROTECTION
-- ============================================================
create unique index registration_holds_active_user_category_uidx
  on public.registration_holds (user_id, category_id)
  where status = 'active' and user_id is not null;
create unique index registration_holds_active_session_category_uidx
  on public.registration_holds (session_id, category_id)
  where status = 'active' and session_id is not null;

alter table public.race_categories
  add constraint race_categories_max_slots_positive
  check (max_slots is null or max_slots > 0) not valid;
alter table public.race_categories
  add constraint race_categories_confirmed_count_valid
  check (confirmed_count >= 0 and (max_slots is null or confirmed_count <= max_slots)) not valid;

create or replace function private.prevent_financial_history_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Financial and payment history is append-only and cannot be deleted';
end;
$$;

create trigger payments_prevent_delete_hardening
  before delete on public.payments for each row
  execute function private.prevent_financial_history_delete();
create trigger payment_transactions_prevent_delete_hardening
  before delete on public.payment_transactions for each row
  execute function private.prevent_financial_history_delete();
create trigger refunds_prevent_delete_hardening
  before delete on public.refunds for each row
  execute function private.prevent_financial_history_delete();
create trigger payment_receipts_prevent_delete_hardening
  before delete on public.payment_receipts for each row
  execute function private.prevent_financial_history_delete();
create trigger invoices_prevent_delete_hardening
  before delete on public.invoices for each row
  execute function private.prevent_financial_history_delete();
create trigger platform_fees_prevent_delete_hardening
  before delete on public.platform_fees for each row
  execute function private.prevent_financial_history_delete();

create trigger organization_payout_accounts_prevent_delete_hardening
  before delete on public.organization_payout_accounts for each row
  execute function private.prevent_financial_history_delete();

create trigger organization_roles_updated_at_hardening
  before update on public.racedeck_internal_user_roles for each row
  execute function public.set_payment_updated_at();
create trigger organizer_verifications_updated_at_hardening
  before update on public.organizer_verifications for each row
  execute function public.set_payment_updated_at();
create trigger organization_payout_accounts_updated_at_hardening
  before update on public.organization_payout_accounts for each row
  execute function public.set_payment_updated_at();

-- Explicit parent-key indexes for history and retry workloads.
create index if not exists event_status_history_event_idx
  on public.event_status_history (event_id, changed_at desc);
create index if not exists event_review_history_event_idx
  on public.event_review_history (event_id, reviewed_at desc);
create index if not exists event_schedules_event_idx
  on public.event_schedules (event_id, scheduled_at);
create index if not exists event_routes_event_idx
  on public.event_routes (event_id);
create index if not exists event_partners_event_idx
  on public.event_partners (event_id);
create index if not exists registration_fields_event_idx
  on public.event_registration_fields (event_id);
create index if not exists registration_field_options_field_idx
  on public.event_registration_field_options (field_id);
create index if not exists registration_responses_registration_idx
  on public.registration_responses (registration_id);
create index if not exists registration_status_history_registration_idx
  on public.registration_status_history (registration_id, changed_at desc);
create index if not exists payment_webhooks_retry_idx
  on public.payment_webhook_events (status, next_retry_at)
  where status in ('received', 'processing', 'failed');
create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status);
create index if not exists registrations_event_user_idx
  on public.registrations (event_id, user_id);

-- Replace the deprecated helper implementation while preserving its public API.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_org_member_hardened(org_id);
$$;

create or replace function public.has_org_role(
  org_id uuid,
  required_role public.organization_role
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = (select auth.uid())
      and om.role = required_role
      and om.is_active
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, public.organization_role) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role) to authenticated;
