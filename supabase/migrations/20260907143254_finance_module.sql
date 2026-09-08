-- RaceDeck Finance module
-- This migration stores payout and reconciliation controls only. Authoritative
-- calculations and privileged state changes belong to trusted finance services.

create type payout_status as enum ('pending', 'processing', 'paid', 'failed', 'cancelled');
create type reconciliation_status as enum ('pending', 'matched', 'discrepancy', 'reviewed');
create type reconciliation_discrepancy_status as enum ('none', 'open', 'resolved');

create table public.finance_reconciliation_records (
  id uuid primary key default gen_random_uuid(),
  reconciliation_reference text not null unique,
  organization_id uuid references public.organizations(id) on delete restrict,
  reconciliation_period_start timestamptz not null,
  reconciliation_period_end timestamptz not null,
  gateway_provider text,
  gateway_reported_gross_amount numeric(12,2) not null default 0,
  recorded_gross_payments numeric(12,2) not null default 0,
  refunds_amount numeric(12,2) not null default 0,
  net_collected_amount numeric(12,2) not null default 0,
  gateway_reported_net_collected_amount numeric(12,2),
  platform_fees_amount numeric(12,2) not null default 0,
  processing_fees_amount numeric(12,2) not null default 0,
  other_adjustments_amount numeric(12,2) not null default 0,
  organizer_payable_amount numeric(12,2) not null default 0,
  payouts_sent_amount numeric(12,2) not null default 0,
  remaining_payable_amount numeric(12,2) not null default 0,
  discrepancy_amount numeric(12,2) not null default 0,
  discrepancy_status reconciliation_discrepancy_status not null default 'none',
  status reconciliation_status not null default 'pending',
  reconciled_by uuid references auth.users(id) on delete set null,
  reconciled_at timestamptz,
  notes text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reconciliation_reference_not_blank check (btrim(reconciliation_reference) <> ''),
  constraint reconciliation_provider_not_blank check (
    gateway_provider is null or btrim(gateway_provider) <> ''
  ),
  constraint reconciliation_period_valid check (reconciliation_period_end >= reconciliation_period_start),
  constraint reconciliation_amounts_nonnegative check (
    gateway_reported_gross_amount >= 0 and recorded_gross_payments >= 0
    and refunds_amount >= 0 and net_collected_amount >= 0
    and (gateway_reported_net_collected_amount is null or gateway_reported_net_collected_amount >= 0)
    and platform_fees_amount >= 0 and processing_fees_amount >= 0
    and payouts_sent_amount >= 0
  ),
  constraint reconciliation_net_collected_consistent check (
    net_collected_amount = recorded_gross_payments - refunds_amount
  ),
  constraint reconciliation_organizer_payable_consistent check (
    organizer_payable_amount = net_collected_amount - platform_fees_amount
      - processing_fees_amount + other_adjustments_amount
  ),
  constraint reconciliation_remaining_payable_consistent check (
    remaining_payable_amount = organizer_payable_amount - payouts_sent_amount
  ),
  constraint reconciliation_gateway_discrepancy_consistent check (
    (gateway_reported_net_collected_amount is null and discrepancy_amount = 0)
    or (gateway_reported_net_collected_amount is not null
      and discrepancy_amount = gateway_reported_net_collected_amount - net_collected_amount)
  ),
  constraint reconciliation_discrepancy_state_consistent check (
    (discrepancy_amount = 0 and discrepancy_status = 'none')
    or (discrepancy_amount <> 0 and discrepancy_status in ('open', 'resolved'))
  ),
  constraint reconciliation_review_metadata check (
    (status <> 'reviewed' and reconciled_at is null and reconciled_by is null)
    or (status = 'reviewed' and reconciled_at is not null and reconciled_by is not null)
  )
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payout_reference text not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payout_account_reference text not null,
  reconciliation_id uuid references public.finance_reconciliation_records(id) on delete restrict,
  idempotency_key text not null,
  payout_period_start timestamptz,
  payout_period_end timestamptz,
  gross_registration_sales numeric(12,2) not null default 0,
  refunds_deducted numeric(12,2) not null default 0,
  platform_fees_deducted numeric(12,2) not null default 0,
  processing_fees_deducted numeric(12,2) not null default 0,
  other_adjustments numeric(12,2) not null default 0,
  net_payout_amount numeric(12,2) not null default 0,
  currency text not null default 'PHP',
  status payout_status not null default 'pending',
  initiated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  initiated_at timestamptz not null default now(),
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  failure_reason text,
  external_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payouts_reference_not_blank check (btrim(payout_reference) <> ''),
  constraint payouts_account_reference_not_blank check (btrim(payout_account_reference) <> ''),
  constraint payouts_idempotency_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint payouts_period_valid check (
    payout_period_start is null or payout_period_end is null
    or payout_period_end >= payout_period_start
  ),
  constraint payouts_amounts_nonnegative check (
    gross_registration_sales >= 0 and refunds_deducted >= 0
    and platform_fees_deducted >= 0 and processing_fees_deducted >= 0
    and net_payout_amount >= 0
  ),
  constraint payouts_net_amount_consistent check (
    net_payout_amount = gross_registration_sales - refunds_deducted
      - platform_fees_deducted - processing_fees_deducted + other_adjustments
  ),
  constraint payouts_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint payouts_status_metadata check (
    (status = 'pending' and processing_at is null and paid_at is null)
    or (status = 'processing' and processing_at is not null and paid_at is null)
    or (status = 'paid' and processing_at is not null and paid_at is not null)
    or (status in ('failed', 'cancelled') and paid_at is null)
  ),
  constraint payouts_failure_reason_required check (
    status not in ('failed', 'cancelled')
    or (failure_reason is not null and btrim(failure_reason) <> '')
  ),
  constraint payouts_approval_metadata check (
    status = 'pending' or (approved_by is not null and approved_at is not null)
  )
);

create unique index payouts_org_idempotency_uidx
  on public.payouts (organization_id, idempotency_key);
create index payouts_organization_idx on public.payouts (organization_id);
create index payouts_status_created_idx on public.payouts (status, created_at desc);
create index payouts_period_idx on public.payouts (organization_id, payout_period_start, payout_period_end);
create index payouts_account_idx on public.payouts (payout_account_reference);
create index payouts_reconciliation_idx on public.payouts (reconciliation_id);
create index payouts_initiated_by_idx on public.payouts (initiated_by);
create index payouts_external_reference_idx on public.payouts (external_reference)
  where external_reference is not null;
create index reconciliation_organization_idx
  on public.finance_reconciliation_records (organization_id);
create index reconciliation_period_idx
  on public.finance_reconciliation_records (reconciliation_period_start, reconciliation_period_end);
create index reconciliation_status_idx
  on public.finance_reconciliation_records (status, discrepancy_status);
create index reconciliation_provider_idx
  on public.finance_reconciliation_records (gateway_provider)
  where gateway_provider is not null;
create index reconciliation_reconciled_by_idx
  on public.finance_reconciliation_records (reconciled_by);

create or replace function private.validate_payout_record()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id
      or new.idempotency_key <> old.idempotency_key
      or new.gross_registration_sales <> old.gross_registration_sales
      or new.refunds_deducted <> old.refunds_deducted
      or new.platform_fees_deducted <> old.platform_fees_deducted
      or new.processing_fees_deducted <> old.processing_fees_deducted
      or new.other_adjustments <> old.other_adjustments
      or new.net_payout_amount <> old.net_payout_amount
      or new.currency <> old.currency
      or new.payout_account_reference <> old.payout_account_reference then
      raise exception 'Payout financial facts are immutable';
    end if;
    if old.status = 'paid' then raise exception 'Paid payouts are immutable'; end if;
    if old.status in ('failed', 'cancelled') and new.status <> old.status then
      raise exception 'Failed or cancelled payouts cannot be restarted';
    end if;
    if old.status = 'pending' and new.status not in ('pending', 'processing', 'failed', 'cancelled') then
      raise exception 'Invalid payout state transition';
    end if;
    if old.status = 'processing' and new.status not in ('processing', 'paid', 'failed', 'cancelled') then
      raise exception 'Invalid payout state transition';
    end if;
  end if;
  if new.status = 'paid' and new.paid_at < new.processing_at then
    raise exception 'Payout paid timestamp cannot precede processing timestamp';
  end if;
  if new.status <> 'pending' and new.approved_by is null and (select auth.uid()) is not null then
    raise exception 'Payout approval is required';
  end if;
  return new;
end;
$$;

create or replace function private.validate_reconciliation_record()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'reviewed' then
    raise exception 'Reviewed reconciliation records are immutable; create a new review record';
  end if;
  if new.status = 'reviewed' and (select auth.uid()) is not null
    and new.reconciled_by is distinct from (select auth.uid()) then
    raise exception 'Reconciliation reviewer must be the authenticated actor';
  end if;
  return new;
end;
$$;

create trigger payouts_validate_trigger
  before insert or update on public.payouts
  for each row execute function private.validate_payout_record();
create trigger reconciliation_validate_trigger
  before insert or update on public.finance_reconciliation_records
  for each row execute function private.validate_reconciliation_record();
create trigger payouts_updated_at_trigger
  before update on public.payouts
  for each row execute function public.set_payment_updated_at();
create trigger reconciliation_updated_at_trigger
  before update on public.finance_reconciliation_records
  for each row execute function public.set_payment_updated_at();

create or replace function private.prevent_finance_delete()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  raise exception 'Financial records are append-only and cannot be deleted';
end;
$$;

create trigger payouts_prevent_delete_trigger
  before delete on public.payouts
  for each row execute function private.prevent_finance_delete();
create trigger reconciliation_prevent_delete_trigger
  before delete on public.finance_reconciliation_records
  for each row execute function private.prevent_finance_delete();

alter table public.payouts enable row level security;
alter table public.finance_reconciliation_records enable row level security;

create policy "Finance members can view organization payouts"
  on public.payouts for select to authenticated
  using (exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = payouts.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'view_financials'
  ));

create policy "Finance members can view organization reconciliations"
  on public.finance_reconciliation_records for select to authenticated
  using (organization_id is not null and exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = finance_reconciliation_records.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'view_financials'
  ));

revoke all on public.payouts, public.finance_reconciliation_records from public, anon, authenticated;
grant select on public.payouts, public.finance_reconciliation_records to authenticated;
grant all on public.payouts, public.finance_reconciliation_records to service_role;
