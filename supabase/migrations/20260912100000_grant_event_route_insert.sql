-- Allow the server-side organizer asset endpoint to persist route-map metadata.
-- Tenant ownership is still enforced by the organizer API before this insert.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.event_routes to service_role;
