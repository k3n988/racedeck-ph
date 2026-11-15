-- Restore the organizer API privileges expected by the promo-code module.
-- RLS remains enabled and continues to scope access to authorized organizers.
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

alter table public.promo_codes enable row level security;
alter table public.promo_code_categories enable row level security;
alter table public.promo_code_redemptions enable row level security;

grant select, insert, update, delete
  on public.promo_codes, public.promo_code_categories
  to authenticated;
grant select on public.promo_code_redemptions to authenticated;

-- Keep organizer authorization inside the hardened permission helper so the
-- policies do not depend on direct grants to membership/permission tables.
create or replace function private.user_has_promo_code(p_promo_code_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    where r.promo_code_id = p_promo_code_id
      and r.user_id = (select auth.uid())
  );
$$;

revoke all on function private.user_has_promo_code(uuid) from public, anon, authenticated;
grant execute on function private.user_has_promo_code(uuid) to authenticated;

drop policy if exists "Promo managers can view their organization promo codes" on public.promo_codes;
create policy "Promo managers can view their organization promo codes"
  on public.promo_codes for select to authenticated
  using (private.has_org_permission(organization_id, 'manage_promo_codes', event_id));

drop policy if exists "Participants can view their assigned promo code" on public.promo_codes;
create policy "Participants can view their assigned promo code"
  on public.promo_codes for select to authenticated
  using (private.user_has_promo_code(id));

drop policy if exists "Promo managers can create promo codes" on public.promo_codes;
create policy "Promo managers can create promo codes"
  on public.promo_codes for insert to authenticated
  with check (private.has_org_permission(organization_id, 'manage_promo_codes', event_id));

drop policy if exists "Promo managers can update promo codes" on public.promo_codes;
create policy "Promo managers can update promo codes"
  on public.promo_codes for update to authenticated
  using (private.has_org_permission(organization_id, 'manage_promo_codes', event_id))
  with check (private.has_org_permission(organization_id, 'manage_promo_codes', event_id));

drop policy if exists "Promo managers can delete promo codes" on public.promo_codes;
create policy "Promo managers can delete promo codes"
  on public.promo_codes for delete to authenticated
  using (private.has_org_permission(organization_id, 'manage_promo_codes', event_id));

drop policy if exists "Promo managers can manage category restrictions" on public.promo_code_categories;
create policy "Promo managers can manage category restrictions"
  on public.promo_code_categories for all to authenticated
  using (exists (
    select 1
    from public.promo_codes pc
    where pc.id = promo_code_id
      and private.has_org_permission(pc.organization_id, 'manage_promo_codes', pc.event_id)
  ))
  with check (exists (
    select 1
    from public.promo_codes pc
    where pc.id = promo_code_id
      and private.has_org_permission(pc.organization_id, 'manage_promo_codes', pc.event_id)
  ));
