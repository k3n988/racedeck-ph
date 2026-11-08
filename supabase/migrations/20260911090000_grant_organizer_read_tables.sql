-- Server-side organizer APIs use the service-role client after validating
-- the authenticated user's organization membership and permissions.
-- Keep tenant scoping in the API layer; this grant only permits the trusted
-- server client to read the existing operational tables.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.events,
  public.race_categories,
  public.registrations,
  public.payments
to service_role;

-- Category management routes also use the authenticated client and rely on
-- RLS policies for organization/event authorization.
grant select, insert, update, delete on table
  public.events,
  public.race_categories
to authenticated;
