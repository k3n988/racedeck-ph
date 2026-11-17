create table public.organization_payment_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_name text not null,
  currency text not null default 'PHP',
  account_holder_name text not null,
  notification_email text not null,
  contact_phone text not null,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  country_code text not null,
  city text not null,
  state_province text not null,
  payment_method text not null default 'direct_deposit',
  payout_frequency text not null default 'weekly',
  swift_bic text not null,
  bank_account_number_encrypted text not null,
  bank_account_number_last4 text not null,
  bank_name text not null,
  bank_address text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_payment_profiles_name_not_blank check (btrim(profile_name) <> ''),
  constraint organization_payment_profiles_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint organization_payment_profiles_country_iso check (country_code ~ '^[A-Z]{2}$'),
  constraint organization_payment_profiles_swift_format check (swift_bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  constraint organization_payment_profiles_method check (payment_method = 'direct_deposit'),
  constraint organization_payment_profiles_frequency check (payout_frequency = 'weekly'),
  constraint organization_payment_profiles_last4 check (bank_account_number_last4 ~ '^[A-Z0-9]{4}$'),
  unique (organization_id, profile_name)
);

create index organization_payment_profiles_org_idx
  on public.organization_payment_profiles (organization_id, created_at desc);

create trigger organization_payment_profiles_updated_at_trigger
  before update on public.organization_payment_profiles
  for each row execute function public.set_payment_updated_at();

alter table public.organization_payment_profiles enable row level security;
revoke all on public.organization_payment_profiles from anon, authenticated;
grant all on public.organization_payment_profiles to service_role;

comment on table public.organization_payment_profiles is
  'Organizer payment profiles. Bank account numbers are application-encrypted and only accessed by owner-authorized server routes.';
comment on column public.organization_payment_profiles.bank_account_number_encrypted is
  'AES-256-GCM encrypted by the server using PAYMENT_PROFILE_ENCRYPTION_KEY.';
