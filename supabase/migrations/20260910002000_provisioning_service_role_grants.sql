-- The server-only provisioning client needs write privileges for the rows it
-- creates after Supabase Auth signup. RLS remains enabled for client roles;
-- this grant does not expose the service role key or any browser access.
grant select, insert, update on table
  public.user_profiles,
  public.organizations,
  public.organization_members
to service_role;
