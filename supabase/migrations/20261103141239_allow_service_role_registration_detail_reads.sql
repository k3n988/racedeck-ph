-- The internal registration detail views use a server-side service client.
-- Keep participant answers and status history inaccessible to public roles.
grant select on table public.registration_responses to service_role;
grant select on table public.registration_status_history to service_role;
