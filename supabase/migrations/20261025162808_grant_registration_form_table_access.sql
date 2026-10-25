-- Expose registration form tables to the Data API while keeping row access
-- constrained by the existing public and organizer RLS policies.
grant select on public.event_registration_fields,
  public.event_registration_field_options to anon, authenticated;

-- Server routes verify organizer permissions before using the service role.
grant select, insert, update, delete on public.event_registration_fields,
  public.event_registration_field_options to service_role;
