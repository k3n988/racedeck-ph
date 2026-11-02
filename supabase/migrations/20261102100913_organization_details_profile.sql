alter table public.organizations
  add column country_code text not null default 'PH',
  add column state_province text,
  add column city text,
  add column postal_code text,
  add column timezone text not null default 'Asia/Manila',
  add column is_nonprofit boolean not null default false,
  add column contact_phone_extension text;

alter table public.organizations
  add constraint organizations_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),
  add constraint organizations_timezone_not_blank
    check (length(trim(timezone)) > 0);

update storage.buckets
set allowed_mime_types = array['image/gif', 'image/jpeg', 'image/png']::text[]
where id = 'organization-logos';
