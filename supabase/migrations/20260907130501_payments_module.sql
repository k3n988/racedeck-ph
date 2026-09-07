-- ============================================================
-- RaceDeck PH — Migration 004: Payments, Transactions, Webhooks,
--      Refunds, and Platform Fees
--
-- Payment state is authoritative only when written by trusted server-side
-- services or payment gateway webhooks. Client roles have read-only access.
-- ============================================================

-- Keep payment states extensible at the application boundary while making
-- invalid states impossible in the database.
create type payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'cancelled',
  'partially_refunded', 'refunded', 'expired'
);

create type payment_transaction_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
);

create type payment_webhook_event_status as enum (
  'received', 'processing', 'processed', 'failed', 'ignored'
);

create type refund_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'cancelled'
);

create type platform_fee_status as enum (
  'pending', 'accrued', 'collected', 'reversed', 'waived'
);

-- ============================================================
-- PAYMENTS — one logical payment aggregate per registration
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  gateway text not null,
  gateway_payment_id text,
  gateway_customer_id text,
  checkout_url text,
  idempotency_key text,

  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  amount_refunded numeric(12,2) not null default 0,
  currency text not null default 'PHP',
  status payment_status not null default 'pending',
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_amount_due_nonnegative check (amount_due >= 0),
  constraint payments_amount_paid_nonnegative check (amount_paid >= 0),
  constraint payments_amount_refunded_nonnegative check (amount_refunded >= 0),
  constraint payments_refund_not_above_paid check (amount_refunded <= amount_paid),
  constraint payments_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint payments_gateway_not_blank check (btrim(gateway) <> ''),
  constraint payments_idempotency_key_not_blank check (idempotency_key is null or btrim(idempotency_key) <> '')
);

-- A gateway reference is unique only when supplied; NULLs are allowed for
-- payment intents created before the gateway returns an object ID.
create unique index payments_gateway_payment_id_uidx
  on public.payments (gateway, gateway_payment_id)
  where gateway_payment_id is not null;
create unique index payments_gateway_idempotency_key_uidx
  on public.payments (gateway, idempotency_key)
  where idempotency_key is not null;
create index payments_event_idx on public.payments (event_id);
create index payments_organization_idx on public.payments (organization_id);
create index payments_status_created_idx on public.payments (status, created_at desc);
create index payments_pending_expiry_idx on public.payments (expires_at)
  where status in ('pending', 'processing') and expires_at is not null;

-- ============================================================
-- PAYMENT TRANSACTIONS — immutable gateway attempts/updates
-- ============================================================
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  attempt_number integer not null default 1,
  gateway text not null,
  gateway_transaction_id text,
  idempotency_key text,
  transaction_type text not null default 'payment',
  status payment_transaction_status not null default 'pending',
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  failure_code text,
  failure_message text,
  gateway_response jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_transactions_attempt_positive check (attempt_number > 0),
  constraint payment_transactions_amount_nonnegative check (amount >= 0),
  constraint payment_transactions_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_gateway_not_blank check (btrim(gateway) <> ''),
  constraint payment_transactions_type_not_blank check (btrim(transaction_type) <> ''),
  constraint payment_transactions_idempotency_not_blank check (idempotency_key is null or btrim(idempotency_key) <> ''),
  unique (payment_id, attempt_number)
);

create unique index payment_transactions_gateway_id_uidx
  on public.payment_transactions (gateway, gateway_transaction_id)
  where gateway_transaction_id is not null;
create unique index payment_transactions_gateway_idempotency_uidx
  on public.payment_transactions (gateway, idempotency_key)
  where idempotency_key is not null;
create index payment_transactions_payment_idx on public.payment_transactions (payment_id, created_at desc);
create index payment_transactions_registration_idx on public.payment_transactions (registration_id);
create index payment_transactions_event_idx on public.payment_transactions (event_id);
create index payment_transactions_organization_idx on public.payment_transactions (organization_id);

-- ============================================================
-- PAYMENT WEBHOOK EVENTS — durable, idempotently accepted gateway events
-- ============================================================
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  gateway_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  payload_hash text,
  status payment_webhook_event_status not null default 'received',
  payment_id uuid references public.payments(id) on delete set null,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  processing_attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  next_retry_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_webhook_gateway_not_blank check (btrim(gateway) <> ''),
  constraint payment_webhook_event_id_not_blank check (btrim(gateway_event_id) <> ''),
  constraint payment_webhook_type_not_blank check (btrim(event_type) <> ''),
  constraint payment_webhook_attempts_nonnegative check (processing_attempts >= 0),
  unique (gateway, gateway_event_id)
);

create index payment_webhook_status_retry_idx
  on public.payment_webhook_events (status, next_retry_at)
  where status in ('received', 'failed');
create index payment_webhook_payment_idx on public.payment_webhook_events (payment_id);
create index payment_webhook_transaction_idx on public.payment_webhook_events (transaction_id);
create index payment_webhook_registration_idx on public.payment_webhook_events (registration_id);
create index payment_webhook_event_idx on public.payment_webhook_events (event_id);
create index payment_webhook_organization_idx on public.payment_webhook_events (organization_id);
create index payment_webhook_received_idx on public.payment_webhook_events (received_at desc);

-- ============================================================
-- REFUNDS
-- ============================================================
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  gateway text not null,
  gateway_refund_id text,
  idempotency_key text,
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  reason text,
  status refund_status not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  failure_code text,
  failure_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint refunds_amount_positive check (amount > 0),
  constraint refunds_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint refunds_gateway_not_blank check (btrim(gateway) <> ''),
  constraint refunds_idempotency_not_blank check (idempotency_key is null or btrim(idempotency_key) <> '')
);

create unique index refunds_gateway_refund_id_uidx
  on public.refunds (gateway, gateway_refund_id)
  where gateway_refund_id is not null;
create unique index refunds_gateway_idempotency_uidx
  on public.refunds (gateway, idempotency_key)
  where idempotency_key is not null;
create index refunds_payment_idx on public.refunds (payment_id, created_at desc);
create index refunds_transaction_idx on public.refunds (transaction_id);
create index refunds_registration_idx on public.refunds (registration_id);
create index refunds_event_idx on public.refunds (event_id);
create index refunds_organization_idx on public.refunds (organization_id);

-- ============================================================
-- PLATFORM FEES
-- ============================================================
create table public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  fee_type text not null default 'platform',
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  status platform_fee_status not null default 'pending',
  collected_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_fees_amount_nonnegative check (amount >= 0),
  constraint platform_fees_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint platform_fees_type_not_blank check (btrim(fee_type) <> ''),
  unique (payment_id, fee_type)
);

create index platform_fees_organization_idx on public.platform_fees (organization_id);
create index platform_fees_event_idx on public.platform_fees (event_id);
create index platform_fees_payment_idx on public.platform_fees (payment_id);
create index platform_fees_transaction_idx on public.platform_fees (transaction_id);
create index platform_fees_status_created_idx on public.platform_fees (status, created_at desc);

-- Keep modification timestamps reliable for reconciliation and audit views.
create or replace function public.set_payment_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_payment_updated_at();
create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_payment_updated_at();
create trigger payment_webhook_events_set_updated_at
  before update on public.payment_webhook_events
  for each row execute function public.set_payment_updated_at();
create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function public.set_payment_updated_at();
create trigger platform_fees_set_updated_at
  before update on public.platform_fees
  for each row execute function public.set_payment_updated_at();

-- ============================================================
-- PAYMENT-ONLY WRITE PATH
-- ============================================================
-- Existing registration policies allowed an organization member to update
-- status directly. Restrict the two payment-derived terminal states at the
-- privilege layer and add a trigger defense-in-depth check below.
revoke update (status) on public.registrations from anon, authenticated;
revoke execute on function public.confirm_registration(uuid) from public, anon, authenticated;
revoke execute on function public.release_registration_slot(uuid, registration_status) from public, anon, authenticated;
grant execute on function public.confirm_registration(uuid) to service_role;
grant execute on function public.release_registration_slot(uuid, registration_status) to service_role;

create or replace function public.prevent_untrusted_payment_status_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('confirmed', 'refunded')
     and new.status is distinct from old.status
     and coalesce(current_setting('racedeck.payment_state_write', true), 'off') <> 'on' then
    raise exception 'payment-derived registration status can only be changed by the payment service';
  end if;
  return new;
end;
$$;

create trigger registrations_payment_status_guard
  before update of status on public.registrations
  for each row execute function public.prevent_untrusted_payment_status_change();

-- Replace the existing confirmation helper with the same capacity-safe logic,
-- adding a transaction-local trust marker for the guard trigger.
create or replace function public.confirm_registration(p_registration_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_id uuid;
  v_max_slots integer;
  v_confirmed_count integer;
  v_current_status registration_status;
begin
  perform set_config('racedeck.payment_state_write', 'on', true);
  select category_id, status into v_category_id, v_current_status
  from public.registrations where id = p_registration_id for update;

  if not found then return false; end if;
  if v_current_status = 'confirmed' then return true; end if;

  select max_slots, confirmed_count into v_max_slots, v_confirmed_count
  from public.race_categories where id = v_category_id for update;
  if v_max_slots is not null and v_confirmed_count >= v_max_slots then return false; end if;

  update public.registrations set status = 'confirmed', updated_at = now()
  where id = p_registration_id;
  update public.race_categories
  set confirmed_count = confirmed_count + 1,
      registration_availability = case
        when max_slots is not null and confirmed_count + 1 >= max_slots
          then 'sold_out'::registration_availability_status
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

create or replace function public.release_registration_slot(
  p_registration_id uuid,
  p_new_status registration_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_id uuid;
  v_current_status registration_status;
begin
  if p_new_status in ('confirmed', 'refunded') then
    perform set_config('racedeck.payment_state_write', 'on', true);
  end if;

  select category_id, status into v_category_id, v_current_status
  from public.registrations where id = p_registration_id for update;
  if not found then return; end if;

  update public.registrations
  set status = p_new_status, updated_at = now()
  where id = p_registration_id;

  if v_current_status = 'confirmed' then
    update public.race_categories
    set confirmed_count = greatest(confirmed_count - 1, 0),
        registration_availability = case
          when registration_availability = 'sold_out'
            then 'open'::registration_availability_status
          else registration_availability
        end
    where id = v_category_id;
  end if;

  insert into public.registration_status_history (registration_id, from_status, to_status)
    values (p_registration_id, v_current_status, p_new_status);
end;
$$;

-- ============================================================
-- RLS / LEAST-PRIVILEGE API ACCESS
-- ============================================================
alter table public.payments enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.platform_fees enable row level security;

revoke all on public.payments, public.payment_transactions,
  public.payment_webhook_events, public.refunds, public.platform_fees
  from anon, authenticated;
grant select on public.payments, public.payment_transactions,
  public.payment_webhook_events, public.refunds, public.platform_fees
  to authenticated;
grant all on public.payments, public.payment_transactions,
  public.payment_webhook_events, public.refunds, public.platform_fees
  to service_role;

create policy "Participants can view their payments"
  on public.payments for select to authenticated
  using (exists (select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())));
create policy "Organization members can view payments"
  on public.payments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "Participants can view their payment transactions"
  on public.payment_transactions for select to authenticated
  using (exists (select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())));
create policy "Organization members can view payment transactions"
  on public.payment_transactions for select to authenticated
  using (public.is_org_member(organization_id));

create policy "Participants can view their refunds"
  on public.refunds for select to authenticated
  using (exists (select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())));
create policy "Organization members can view refunds"
  on public.refunds for select to authenticated
  using (public.is_org_member(organization_id));

create policy "Organization members can view webhook events"
  on public.payment_webhook_events for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

create policy "Organization members can view platform fees"
  on public.platform_fees for select to authenticated
  using (public.is_org_member(organization_id));
