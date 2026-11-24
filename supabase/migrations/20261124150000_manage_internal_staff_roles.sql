-- Let trusted platform admins manage staff assignments while keeping role
-- definitions and permission mappings controlled by migrations.
insert into public.internal_role_permissions (role, permission_id)
select 'admin'::public.racedeck_internal_role, p.id
from public.permissions p
where p.key = 'manage_internal_roles'
on conflict do nothing;

create or replace function public.grant_internal_user_roles(
  p_user_id uuid,
  p_roles public.racedeck_internal_role[],
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_is_super boolean;
begin
  perform pg_advisory_xact_lock(hashtext('racedeck_internal_user_roles'));

  select exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = p_actor_user_id and r.role = 'super_admin' and r.is_active
  ) into actor_is_super;

  if not actor_is_super and not exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = p_actor_user_id and r.role = 'admin' and r.is_active
  ) then
    raise exception 'Internal role management permission required';
  end if;
  if p_user_id is null or p_actor_user_id is null or p_roles is null
    or cardinality(p_roles) = 0 or cardinality(p_roles) > 4 then
    raise exception 'Choose one or more valid roles';
  end if;
  if array_position(p_roles, null) is not null
    or cardinality(p_roles) <> (select count(distinct selected_role) from unnest(p_roles) as roles(selected_role)) then
    raise exception 'Duplicate roles are not allowed';
  end if;
  if 'super_admin'::public.racedeck_internal_role = any(p_roles) and not actor_is_super then
    raise exception 'Only a super administrator can grant the super administrator role';
  end if;

  insert into public.racedeck_internal_user_roles (user_id, role, is_active, assigned_by)
  select p_user_id, selected_role, true, p_actor_user_id from unnest(p_roles) as roles(selected_role)
  on conflict (user_id, role) do update
    set is_active = true, assigned_by = excluded.assigned_by, updated_at = now();

  insert into public.audit_logs (actor_user_id, actor_role_context, action, resource_type, resource_id, new_values)
  values (
    p_actor_user_id,
    case when actor_is_super then 'super_admin' else 'admin' end,
    'internal_roles_granted',
    'role_permission',
    p_user_id,
    jsonb_build_object('roles', to_jsonb(p_roles))
  );
end;
$$;

create or replace function public.revoke_internal_user_role(
  p_user_id uuid,
  p_role public.racedeck_internal_role,
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_is_super boolean;
  changed integer;
begin
  perform pg_advisory_xact_lock(hashtext('racedeck_internal_user_roles'));

  select exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = p_actor_user_id and r.role = 'super_admin' and r.is_active
  ) into actor_is_super;
  if not actor_is_super and not exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = p_actor_user_id and r.role = 'admin' and r.is_active
  ) then
    raise exception 'Internal role management permission required';
  end if;
  if p_role = 'super_admin' and not actor_is_super then
    raise exception 'Only a super administrator can revoke the super administrator role';
  end if;
  if p_user_id = p_actor_user_id and p_role = 'admin' and not actor_is_super then
    raise exception 'Administrators cannot remove their own administrator role';
  end if;

  if p_role = 'super_admin' and exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = p_user_id and r.role = 'super_admin' and r.is_active
  ) and (select count(*) from public.racedeck_internal_user_roles r
    where r.role = 'super_admin' and r.is_active) <= 1 then
    raise exception 'The last active super administrator cannot be removed';
  end if;

  update public.racedeck_internal_user_roles
    set is_active = false, updated_at = now()
    where user_id = p_user_id and role = p_role and is_active;
  get diagnostics changed = row_count;
  if changed = 0 then raise exception 'Active role assignment not found'; end if;

  insert into public.audit_logs (actor_user_id, actor_role_context, action, resource_type, resource_id, previous_values, new_values)
  values (
    p_actor_user_id,
    case when actor_is_super then 'super_admin' else 'admin' end,
    'internal_role_revoked',
    'role_permission',
    p_user_id,
    jsonb_build_object('role', p_role, 'is_active', true),
    jsonb_build_object('role', p_role, 'is_active', false)
  );
end;
$$;

revoke all on function public.grant_internal_user_roles(uuid, public.racedeck_internal_role[], uuid) from public, anon, authenticated;
revoke all on function public.revoke_internal_user_role(uuid, public.racedeck_internal_role, uuid) from public, anon, authenticated;
grant execute on function public.grant_internal_user_roles(uuid, public.racedeck_internal_role[], uuid) to service_role;
grant execute on function public.revoke_internal_user_role(uuid, public.racedeck_internal_role, uuid) to service_role;
