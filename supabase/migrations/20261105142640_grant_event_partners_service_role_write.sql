-- Organizer partner APIs use the server-side service role for validated
-- create, edit, and delete operations. Public reads also use this role.
grant select, insert, update, delete on table public.event_partners to service_role;
