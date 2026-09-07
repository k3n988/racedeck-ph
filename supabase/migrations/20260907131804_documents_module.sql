-- ============================================================
-- RaceDeck PH — Migration 005: Payment Receipts & Sales Invoices
--
-- Documents are immutable financial snapshots created by trusted server-side
-- payment/document services. Participants and authorized organization
-- members receive read-only access through RLS.
-- ============================================================

create type organization_invoice_mode as enum (
  'receipt_only',
  'receipt_and_sales_invoice'
);

create type invoice_status as enum (
  'draft',
  'issued',
  'void',
  'cancelled'
);

-- This setting controls whether the organizer requests a sales invoice in
-- addition to the payment receipt. It does not by itself make any document
-- an official tax invoice.
alter table public.organizations
  add column invoice_mode organization_invoice_mode not null default 'receipt_only';

-- ============================================================
-- PAYMENT RECEIPTS
-- ============================================================
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_reference text not null unique,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  -- Financial/customer values are snapshots so historical documents do not
  -- change when a participant, event, or organization is later edited.
  organization_name text not null,
  participant_name text not null,
  participant_email text not null,
  event_name text not null,
  race_category_name text not null,
  registration_number text not null,

  registration_amount numeric(12,2) not null default 0,
  processing_fee numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null,
  currency text not null default 'PHP',
  payment_method text not null,
  gateway_transaction_reference text,
  payment_date timestamptz not null,
  payment_status payment_status not null default 'succeeded',

  storage_reference text,
  document_hash text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_receipts_reference_not_blank check (btrim(receipt_reference) <> ''),
  constraint payment_receipts_org_name_not_blank check (btrim(organization_name) <> ''),
  constraint payment_receipts_participant_name_not_blank check (btrim(participant_name) <> ''),
  constraint payment_receipts_event_name_not_blank check (btrim(event_name) <> ''),
  constraint payment_receipts_category_not_blank check (btrim(race_category_name) <> ''),
  constraint payment_receipts_registration_number_not_blank check (btrim(registration_number) <> ''),
  constraint payment_receipts_payment_method_not_blank check (btrim(payment_method) <> ''),
  constraint payment_receipts_registration_amount_nonnegative check (registration_amount >= 0),
  constraint payment_receipts_processing_fee_nonnegative check (processing_fee >= 0),
  constraint payment_receipts_platform_fee_nonnegative check (platform_fee >= 0),
  constraint payment_receipts_discount_nonnegative check (discount_amount >= 0),
  constraint payment_receipts_total_paid_nonnegative check (total_paid >= 0),
  constraint payment_receipts_discount_not_above_charges check (
    discount_amount <= registration_amount + processing_fee + platform_fee
  ),
  constraint payment_receipts_total_reconciles check (
    total_paid = registration_amount + processing_fee + platform_fee - discount_amount
  ),
  constraint payment_receipts_currency_iso check (currency ~ '^[A-Z]{3}$')
);

create index payment_receipts_registration_idx on public.payment_receipts (registration_id);
create index payment_receipts_event_idx on public.payment_receipts (event_id);
create index payment_receipts_organization_idx on public.payment_receipts (organization_id);
create index payment_receipts_payment_date_idx on public.payment_receipts (payment_date desc);
create index payment_receipts_status_idx on public.payment_receipts (payment_status);

-- ============================================================
-- SALES INVOICES
-- ============================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint generated always as identity unique,
  invoice_reference text not null unique,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  -- Snapshot of the configuration and issuer identity at issuance time.
  issuance_mode organization_invoice_mode not null,
  issuer_organization_name text not null,
  issuer_business_name text,
  issuer_address text not null,
  issuer_tax_registration_number text,
  issuer_tax_registered_name text,
  issuer_tax_address text,
  is_official_tax_invoice boolean not null default false,
  tax_invoice_disclaimer text,

  participant_name text not null,
  participant_email text not null,
  event_name text not null,
  registration_number text not null,
  line_items jsonb not null default '[]'::jsonb,

  registration_amount numeric(12,2) not null default 0,
  processing_fee numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  currency text not null default 'PHP',
  tax_details jsonb not null default '{}'::jsonb,

  status invoice_status not null default 'draft',
  issued_at timestamptz,
  storage_reference text,
  document_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_reference_not_blank check (btrim(invoice_reference) <> ''),
  constraint invoices_issuance_mode_valid check (issuance_mode = 'receipt_and_sales_invoice'),
  constraint invoices_issuer_org_name_not_blank check (btrim(issuer_organization_name) <> ''),
  constraint invoices_issuer_address_not_blank check (btrim(issuer_address) <> ''),
  constraint invoices_participant_name_not_blank check (btrim(participant_name) <> ''),
  constraint invoices_event_name_not_blank check (btrim(event_name) <> ''),
  constraint invoices_registration_number_not_blank check (btrim(registration_number) <> ''),
  constraint invoices_line_items_array check (jsonb_typeof(line_items) = 'array'),
  constraint invoices_registration_amount_nonnegative check (registration_amount >= 0),
  constraint invoices_processing_fee_nonnegative check (processing_fee >= 0),
  constraint invoices_platform_fee_nonnegative check (platform_fee >= 0),
  constraint invoices_discount_nonnegative check (discount_amount >= 0),
  constraint invoices_subtotal_nonnegative check (subtotal_amount >= 0),
  constraint invoices_tax_nonnegative check (tax_amount >= 0),
  constraint invoices_total_nonnegative check (total_amount >= 0),
  constraint invoices_subtotal_reconciles check (
    subtotal_amount = registration_amount + processing_fee + platform_fee - discount_amount
  ),
  constraint invoices_total_reconciles check (
    total_amount = subtotal_amount + tax_amount
  ),
  constraint invoices_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_issued_timestamp check (
    (status = 'draft' and issued_at is null)
    or (status in ('issued', 'void', 'cancelled') and issued_at is not null)
  ),
  constraint invoices_official_tax_identity check (
    is_official_tax_invoice = false
    or (
      nullif(btrim(issuer_tax_registration_number), '') is not null
      and nullif(btrim(issuer_tax_registered_name), '') is not null
    )
  )
);

create index invoices_registration_idx on public.invoices (registration_id);
create index invoices_event_idx on public.invoices (event_id);
create index invoices_organization_idx on public.invoices (organization_id);
create index invoices_payment_idx on public.invoices (payment_id);
create index invoices_status_issued_idx on public.invoices (status, issued_at desc);

-- A receipt is a success document, not a payment-intent document. The
-- payment_id UNIQUE constraint prevents a second receipt for the same payment
-- and this trigger prevents a receipt for a failed/pending payment.
create or replace function public.validate_payment_receipt_source()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id
      and p.status = 'succeeded'
  ) then
    raise exception 'payment receipt requires a succeeded payment';
  end if;
  return new;
end;
$$;

create trigger payment_receipts_success_source_guard
  before insert on public.payment_receipts
  for each row execute function public.validate_payment_receipt_source();

-- Keep document modification timestamps accurate.
create or replace function public.set_document_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_receipts_set_updated_at
  before update on public.payment_receipts
  for each row execute function public.set_document_updated_at();
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_document_updated_at();

-- ============================================================
-- RLS / LEAST-PRIVILEGE API ACCESS
-- ============================================================
alter table public.payment_receipts enable row level security;
alter table public.invoices enable row level security;

-- Documents are generated and amended only by trusted server-side services.
-- Authenticated clients receive SELECT only, while service_role handles
-- generation, voiding, storage references, and reconciliation.
revoke all on public.payment_receipts, public.invoices from anon, authenticated;
grant select on public.payment_receipts, public.invoices to authenticated;
grant all on public.payment_receipts, public.invoices to service_role;

-- Participants can access documents only through their own registration.
create policy "Participants can view their payment receipts"
  on public.payment_receipts for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

create policy "Participants can view their invoices"
  on public.invoices for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

-- Organizer financial access follows the existing permission architecture:
-- active organization membership plus the view_financials permission granted
-- to that member's role. The existing seed grants this to owners.
create policy "Financial members can view organization receipts"
  on public.payment_receipts for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = payment_receipts.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and p.key = 'view_financials'
  ));

create policy "Financial members can view organization invoices"
  on public.invoices for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = invoices.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and p.key = 'view_financials'
  ));
