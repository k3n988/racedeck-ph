alter table public.organization_payout_accounts
  add column account_holder_name text,
  add column notification_emails text[] not null default '{}'::text[],
  add column contact_phone text,
  add column address_line1 text,
  add column address_line2 text,
  add column postal_code text,
  add column country_code text not null default 'PH',
  add column city text,
  add column state_province text,
  add column swift_bic text,
  add column bank_name text,
  add column bank_address text;

alter table public.organization_payout_accounts
  add constraint payout_accounts_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),
  add constraint payout_accounts_swift_bic_format
    check (swift_bic is null or swift_bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$');
