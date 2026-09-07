-- ============================================================
-- RaceDeck PH — Migration 006: Promo Codes
--
-- Promo validation/redemption is server-side. The redemption function locks
-- the registration and promo-code rows before checking or incrementing usage,
-- so concurrent checkout requests cannot oversubscribe a code.
-- ============================================================

create type promo_discount_type as enum ('fixed_amount', 'percentage');
create type promo_code_status as enum ('active', 'inactive');
create type promo_redemption_status as enum ('applied', 'reversed', 'cancelled');

-- ============================================================
-- PROMO CODES
-- ============================================================
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  description text,
  discount_type promo_discount_type not null,
  discount_value numeric(12,2) not null,
  currency text not null default 'PHP',
  max_discount_amount numeric(12,2),
  minimum_subtotal numeric(12,2) not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  per_user_limit integer,
  status promo_code_status not null default 'active',
  applies_to_all_categories boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promo_codes_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,63}$'),
  constraint promo_codes_description_not_blank check (description is null or btrim(description) <> ''),
  constraint promo_codes_discount_positive check (discount_value > 0),
  constraint promo_codes_percentage_valid check (
    discount_type <> 'percentage' or discount_value <= 100
  ),
  constraint promo_codes_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint promo_codes_max_discount_nonnegative check (
    max_discount_amount is null or max_discount_amount > 0
  ),
  constraint promo_codes_max_discount_type check (
    discount_type = 'percentage' or max_discount_amount is null
  ),
  constraint promo_codes_minimum_subtotal_nonnegative check (minimum_subtotal >= 0),
  constraint promo_codes_date_range_valid check (
    expires_at is null or expires_at > starts_at
  ),
  constraint promo_codes_usage_limit_positive check (
    usage_limit is null or usage_limit > 0
  ),
  constraint promo_codes_usage_count_valid check (
    usage_count >= 0 and (usage_limit is null or usage_count <= usage_limit)
  ),
  constraint promo_codes_per_user_limit_positive check (
    per_user_limit is null or per_user_limit > 0
  ),
  unique (event_id, code)
);

create index promo_codes_organization_idx on public.promo_codes (organization_id);
create index promo_codes_event_status_idx on public.promo_codes (event_id, status);
create index promo_codes_active_window_idx on public.promo_codes (event_id, starts_at, expires_at)
  where status = 'active';

-- ============================================================
-- CATEGORY RESTRICTIONS
-- ============================================================
create table public.promo_code_categories (
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  category_id uuid not null references public.race_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (promo_code_id, category_id)
);

create index promo_code_categories_category_idx
  on public.promo_code_categories (category_id);

-- ============================================================
-- PROMO CODE REDEMPTIONS
-- ============================================================
create table public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  eligible_amount numeric(12,2) not null,
  discount_amount numeric(12,2) not null,
  currency text not null default 'PHP',
  status promo_redemption_status not null default 'applied',
  redeemed_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promo_redemptions_eligible_nonnegative check (eligible_amount >= 0),
  constraint promo_redemptions_discount_nonnegative check (discount_amount >= 0),
  constraint promo_redemptions_discount_not_above_eligible check (
    discount_amount <= eligible_amount
  ),
  constraint promo_redemptions_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint promo_redemptions_reversal_timestamp check (
    (status = 'applied' and reversed_at is null)
    or (status in ('reversed', 'cancelled') and reversed_at is not null)
  ),
  unique (promo_code_id, registration_id)
);

create index promo_redemptions_promo_status_idx
  on public.promo_code_redemptions (promo_code_id, status, redeemed_at desc);
create index promo_redemptions_user_idx
  on public.promo_code_redemptions (user_id, promo_code_id, status);
create index promo_redemptions_event_idx on public.promo_code_redemptions (event_id);
create index promo_redemptions_organization_idx on public.promo_code_redemptions (organization_id);
create index promo_redemptions_payment_idx on public.promo_code_redemptions (payment_id);

-- The existing registrations table reserved this column for the promo module.
alter table public.registrations
  add constraint registrations_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes(id) on delete set null;
create index idx_registrations_promo_code on public.registrations (promo_code_id);

-- ============================================================
-- CROSS-TABLE SCOPE VALIDATION
-- ============================================================
create or replace function public.validate_promo_code_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'promo code organization must own its event';
  end if;
  return new;
end;
$$;

create trigger promo_codes_scope_guard
  before insert or update on public.promo_codes
  for each row execute function public.validate_promo_code_scope();

create or replace function public.validate_promo_category_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.promo_codes pc
    join public.race_categories rc on rc.event_id = pc.event_id
    where pc.id = new.promo_code_id and rc.id = new.category_id
  ) then
    raise exception 'promo category restriction must belong to the promo code event';
  end if;
  return new;
end;
$$;

create trigger promo_code_categories_scope_guard
  before insert or update on public.promo_code_categories
  for each row execute function public.validate_promo_category_scope();

create or replace function public.prevent_untrusted_promo_usage_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.usage_count is distinct from old.usage_count
     and coalesce(current_setting('racedeck.promo_usage_write', true), 'off') <> 'on' then
    raise exception 'promo usage count can only be changed by the redemption service';
  end if;
  return new;
end;
$$;

create trigger promo_codes_usage_guard
  before update of usage_count on public.promo_codes
  for each row execute function public.prevent_untrusted_promo_usage_change();

-- ============================================================
-- CONCURRENCY-SAFE SERVER REDEMPTION
-- ============================================================
create schema if not exists private;

create or replace function private.redeem_promo_code(
  p_promo_code_id uuid,
  p_user_id uuid,
  p_registration_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_payment_id uuid,
  p_eligible_amount numeric(12,2),
  p_currency text default 'PHP'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_registration_event_id uuid;
  v_registration_category_id uuid;
  v_registration_user_id uuid;
  v_registration_promo_code_id uuid;
  v_discount numeric(12,2);
  v_redemption_id uuid;
begin
  if p_eligible_amount is null or p_eligible_amount < 0 then
    raise exception 'eligible amount must be non-negative';
  end if;
  if p_currency is null
     or upper(p_currency) <> p_currency
     or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be a three-letter uppercase code';
  end if;

  -- Lock parent registration first, then the promo row. Every redemption
  -- through this function follows this order to avoid lock-order deadlocks.
  select event_id, category_id, user_id, promo_code_id
    into v_registration_event_id, v_registration_category_id,
         v_registration_user_id, v_registration_promo_code_id
  from public.registrations
  where id = p_registration_id
  for update;
  if not found then raise exception 'registration not found'; end if;

  if v_registration_event_id <> p_event_id
     or v_registration_category_id <> p_category_id then
    raise exception 'registration does not match the supplied event/category';
  end if;
  if p_user_id is distinct from v_registration_user_id then
    raise exception 'promo redemption user does not match registration';
  end if;
  if v_registration_promo_code_id is not null
     and v_registration_promo_code_id <> p_promo_code_id then
    raise exception 'registration already has a different promo code';
  end if;

  select * into v_promo
  from public.promo_codes
  where id = p_promo_code_id
  for update;
  if not found then raise exception 'promo code not found'; end if;

  if v_promo.event_id <> p_event_id or v_promo.currency <> p_currency then
    raise exception 'promo code is not valid for this event/currency';
  end if;
  if v_promo.status <> 'active'
     or v_promo.starts_at > now()
     or (v_promo.expires_at is not null and v_promo.expires_at <= now()) then
    raise exception 'promo code is not currently active';
  end if;
  if p_eligible_amount < v_promo.minimum_subtotal then
    raise exception 'minimum subtotal requirement is not met';
  end if;
  if not v_promo.applies_to_all_categories and not exists (
    select 1 from public.promo_code_categories pcc
    where pcc.promo_code_id = v_promo.id and pcc.category_id = p_category_id
  ) then
    raise exception 'promo code is not valid for this race category';
  end if;
  if v_promo.usage_limit is not null
     and v_promo.usage_count >= v_promo.usage_limit then
    raise exception 'promo code usage limit has been reached';
  end if;
  if p_user_id is not null and v_promo.per_user_limit is not null
     and (
       select count(*)
       from public.promo_code_redemptions pcr
       where pcr.promo_code_id = v_promo.id
         and pcr.user_id = p_user_id
         and pcr.status = 'applied'
     ) >= v_promo.per_user_limit then
    raise exception 'promo code per-user limit has been reached';
  end if;

  if p_payment_id is not null and not exists (
    select 1 from public.payments p
    where p.id = p_payment_id
      and p.registration_id = p_registration_id
      and p.event_id = p_event_id
      and p.organization_id = v_promo.organization_id
  ) then
    raise exception 'payment does not match the promo redemption';
  end if;

  if v_promo.discount_type = 'fixed_amount' then
    v_discount := least(v_promo.discount_value, p_eligible_amount);
  else
    v_discount := round(p_eligible_amount * v_promo.discount_value / 100, 2);
    if v_promo.max_discount_amount is not null then
      v_discount := least(v_discount, v_promo.max_discount_amount);
    end if;
  end if;

  insert into public.promo_code_redemptions (
    promo_code_id, user_id, registration_id, event_id, organization_id,
    payment_id, eligible_amount, discount_amount, currency
  ) values (
    v_promo.id, p_user_id, p_registration_id, p_event_id, v_promo.organization_id,
    p_payment_id, p_eligible_amount, v_discount, p_currency
  ) returning id into v_redemption_id;

  perform set_config('racedeck.promo_usage_write', 'on', true);
  update public.promo_codes
  set usage_count = usage_count + 1
  where id = v_promo.id;

  update public.registrations
  set promo_code_id = v_promo.id, updated_at = now()
  where id = p_registration_id;

  return v_redemption_id;
end;
$$;

revoke execute on function private.redeem_promo_code(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function private.redeem_promo_code(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

-- Reuse the payment module's existing timestamp trigger function.
create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function public.set_payment_updated_at();
create trigger promo_code_categories_set_updated_at
  before update on public.promo_code_categories
  for each row execute function public.set_payment_updated_at();
create trigger promo_redemptions_set_updated_at
  before update on public.promo_code_redemptions
  for each row execute function public.set_payment_updated_at();

-- ============================================================
-- RLS / LEAST-PRIVILEGE ACCESS
-- ============================================================
alter table public.promo_codes enable row level security;
alter table public.promo_code_categories enable row level security;
alter table public.promo_code_redemptions enable row level security;

revoke all on public.promo_codes, public.promo_code_categories,
  public.promo_code_redemptions from anon, authenticated;
grant select, insert, update, delete on public.promo_codes,
  public.promo_code_categories to authenticated;
grant select on public.promo_code_redemptions to authenticated;
grant all on public.promo_codes, public.promo_code_categories,
  public.promo_code_redemptions to service_role;

-- Organizers need the explicit existing manage_promo_codes permission.
create policy "Promo managers can view their organization promo codes"
  on public.promo_codes for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = promo_codes.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and p.key = 'manage_promo_codes'
  ));

create policy "Participants can view their assigned promo code"
  on public.promo_codes for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.promo_code_id = promo_codes.id and r.user_id = (select auth.uid())
  ));

create policy "Promo managers can create promo codes"
  on public.promo_codes for insert to authenticated
  with check (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = promo_codes.event_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and p.key = 'manage_promo_codes'
      and promo_codes.organization_id = e.organization_id
  ));

create policy "Promo managers can update promo codes"
  on public.promo_codes for update to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = promo_codes.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_promo_codes'
  ))
  with check (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = promo_codes.event_id
      and promo_codes.organization_id = e.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_promo_codes'
  ));

create policy "Promo managers can delete promo codes"
  on public.promo_codes for delete to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = promo_codes.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_promo_codes'
  ));

create policy "Promo managers can manage category restrictions"
  on public.promo_code_categories for all to authenticated
  using (exists (
    select 1
    from public.promo_codes pc
    join public.organization_members om on om.organization_id = pc.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where pc.id = promo_code_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_promo_codes'
  ))
  with check (exists (
    select 1
    from public.promo_codes pc
    join public.organization_members om on om.organization_id = pc.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where pc.id = promo_code_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_promo_codes'
  ));

create policy "Participants can view their promo redemptions"
  on public.promo_code_redemptions for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

create policy "Promo managers can view organization redemptions"
  on public.promo_code_redemptions for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = promo_code_redemptions.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_promo_codes'
  ));
