alter table public.registrations
  add column if not exists emergency_contact_relationship text;

alter table public.registrations
  add constraint registrations_emergency_contact_relationship_length_check
  check (
    emergency_contact_relationship is null
    or char_length(emergency_contact_relationship) <= 120
  );
