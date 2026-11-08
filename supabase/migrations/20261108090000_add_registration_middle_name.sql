-- Middle name is optional participant information captured at registration.
alter table public.registrations
  add column if not exists middle_name text;

comment on column public.registrations.middle_name is
  'Optional middle name supplied for the person registered for an event.';
