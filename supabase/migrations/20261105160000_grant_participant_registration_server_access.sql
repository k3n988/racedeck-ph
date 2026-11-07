-- Participant registration endpoints use the service-role client only after
-- validating the event, participant, and submitted registration data.
-- Grant only the operations those routes need; RLS remains enabled.
grant select, update on table public.registration_holds to service_role;
-- SELECT is granted by the earlier registration-detail access migration.
grant insert on table public.registration_responses to service_role;
grant select, insert on table public.registration_activity to service_role;
