-- Organization profile updates still pass through the owner-only RLS policy.
-- This restores the table privilege required by the authenticated server client.
grant update on table public.organizations to authenticated;
