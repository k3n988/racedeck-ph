-- Restore the minimum Data API privileges required by the server-side auth
-- context loader. Row visibility remains enforced by the existing RLS policies.
grant select on table
  public.user_profiles,
  public.organization_members,
  public.organizations,
  public.permissions,
  public.role_permissions,
  public.racedeck_internal_user_roles
to authenticated;
