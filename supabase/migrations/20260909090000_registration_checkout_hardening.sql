-- RaceDeck checkout hardening: serialize slot reservation per category.
-- This is intentionally additive; historical migrations are unchanged.
create or replace function public.reserve_registration_slot(
  p_event_id uuid,
  p_category_id uuid,
  p_user_id uuid,
  p_session_id text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_capacity integer;
  v_max_slots integer;
  v_confirmed_count integer;
  v_event_confirmed_count integer;
  v_event_active_holds integer;
  v_category_active_holds integer;
  v_hold_id uuid;
begin
  if p_expires_at <= now() then
    raise exception 'Slot hold expiry must be in the future';
  end if;

  select overall_capacity
    into v_event_capacity
  from public.events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'Event does not exist';
  end if;

  select max_slots, confirmed_count
    into v_max_slots, v_confirmed_count
  from public.race_categories
  where id = p_category_id and event_id = p_event_id
  for update;
  if not found then
    raise exception 'Category does not belong to event';
  end if;

  update public.registration_holds
  set status = 'expired'
  where event_id = p_event_id
    and status = 'active'
    and expires_at <= now();

  select count(*) into v_event_confirmed_count
  from public.registrations
  where event_id = p_event_id and status = 'confirmed';

  select count(*) into v_event_active_holds
  from public.registration_holds
  where event_id = p_event_id and status = 'active' and expires_at > now();

  if v_event_capacity is not null
    and v_event_confirmed_count + v_event_active_holds >= v_event_capacity then
    return null;
  end if;

  select count(*) into v_category_active_holds
  from public.registration_holds
  where category_id = p_category_id
    and status = 'active'
    and expires_at > now();

  if v_max_slots is not null and v_confirmed_count + (
    v_category_active_holds
  ) >= v_max_slots then
    return null;
  end if;

  insert into public.registration_holds (event_id, category_id, user_id, session_id, status, expires_at)
  values (p_event_id, p_category_id, p_user_id, p_session_id, 'active', p_expires_at)
  returning id into v_hold_id;
  return v_hold_id;
end;
$$;

revoke execute on function public.reserve_registration_slot(uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_registration_slot(uuid, uuid, uuid, text, timestamptz)
  to service_role;

-- Keep the concurrency-safe promo implementation private while providing the
-- server-only API used by the checkout service.
create or replace function public.redeem_promo_code(
  p_promo_code_id uuid,
  p_user_id uuid,
  p_registration_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_payment_id uuid,
  p_eligible_amount numeric(12,2),
  p_currency text default 'PHP'
)
returns uuid
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.redeem_promo_code(
    p_promo_code_id, p_user_id, p_registration_id, p_event_id,
    p_category_id, p_payment_id, p_eligible_amount, p_currency
  );
$$;

revoke execute on function public.redeem_promo_code(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

create or replace function private.reverse_promo_redemption(
  p_payment_id uuid,
  p_registration_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_promo_code_id uuid;
begin
  perform 1 from public.registrations where id = p_registration_id for update;
  if not found then return false; end if;

  select promo_code_id into v_promo_code_id
  from public.promo_code_redemptions
  where payment_id = p_payment_id
    and registration_id = p_registration_id
    and status = 'applied'
  for update;
  if not found then return false; end if;

  perform 1 from public.promo_codes where id = v_promo_code_id for update;
  update public.promo_code_redemptions
  set status = 'reversed', reversed_at = now(), updated_at = now()
  where payment_id = p_payment_id
    and registration_id = p_registration_id
    and status = 'applied';

  perform set_config('racedeck.promo_usage_write', 'on', true);
  update public.promo_codes
  set usage_count = greatest(usage_count - 1, 0), updated_at = now()
  where id = v_promo_code_id;
  return true;
end;
$$;

revoke execute on function private.reverse_promo_redemption(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.reverse_promo_redemption(uuid, uuid)
  to service_role;

create or replace function public.reverse_promo_redemption(
  p_payment_id uuid,
  p_registration_id uuid
)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.reverse_promo_redemption(p_payment_id, p_registration_id);
$$;

revoke execute on function public.reverse_promo_redemption(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reverse_promo_redemption(uuid, uuid)
  to service_role;

-- Atomic sequential/bulk bib allocation for organizer operations. The input
-- order is preserved so the preview and committed assignment are identical.
create or replace function private.assign_bibs_bulk(
  p_registration_ids uuid[],
  p_start_number integer,
  p_assigned_by uuid
)
returns uuid[]
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_event_id uuid;
  v_category_id uuid;
  v_organization_id uuid;
  v_prefix text;
  v_range_start integer;
  v_range_end integer;
  v_count integer;
  v_bib_ids uuid[];
begin
  if p_assigned_by is null or p_registration_ids is null
     or cardinality(p_registration_ids) = 0
     or cardinality(p_registration_ids) > 500
     or p_start_number is null or p_start_number <= 0 then
    raise exception 'Invalid bulk bib assignment request';
  end if;
  select count(distinct id), min(event_id), min(category_id)
    into v_count, v_event_id, v_category_id
  from public.registrations
  where id = any(p_registration_ids);
  if v_count <> cardinality(p_registration_ids) then
    raise exception 'All registrations must exist';
  end if;
  if (select count(distinct event_id) from public.registrations where id = any(p_registration_ids)) <> 1
     or (select count(distinct category_id) from public.registrations where id = any(p_registration_ids)) <> 1 then
    raise exception 'Bulk assignments must use one event and category';
  end if;

  select e.organization_id into v_organization_id from public.events e where e.id = v_event_id for update;
  select bib_prefix, bib_range_start, bib_range_end
    into v_prefix, v_range_start, v_range_end
  from public.race_categories where id = v_category_id and event_id = v_event_id for update;
  if not found then raise exception 'Category does not belong to event'; end if;
  if v_range_start is null or v_range_end is null or v_range_end < v_range_start then
    raise exception 'Category must define a valid bib range';
  end if;
  if p_start_number < v_range_start or p_start_number + cardinality(p_registration_ids) - 1 > v_range_end then
    raise exception 'Bulk bib assignment exceeds the category range';
  end if;
  if exists (select 1 from public.registrations r where r.id = any(p_registration_ids) and r.status <> 'confirmed') then
    raise exception 'Bib assignment requires confirmed registrations';
  end if;
  if exists (select 1 from public.registrations r where r.id = any(p_registration_ids) and r.bib_id is not null) then
    raise exception 'One or more registrations already have an active bib';
  end if;
  if exists (select 1 from public.payments p join public.registrations r on r.id = p.registration_id where r.id = any(p_registration_ids) and p.status <> 'succeeded') then
    raise exception 'Bib assignment requires successful payment';
  end if;
  if exists (select 1 from public.bibs b where b.event_id = v_event_id and b.status = 'active' and b.bib_number between p_start_number and p_start_number + cardinality(p_registration_ids) - 1) then
    raise exception 'One or more bib numbers are already assigned';
  end if;

  with requested as (
    select p_registration_ids[n] as registration_id, p_start_number + n - 1 as bib_number
    from generate_subscripts(p_registration_ids, 1) as s(n)
  ), inserted as (
    insert into public.bibs (event_id, category_id, registration_id, bib_number, bib_code, prefix, status, assignment_source, assigned_by, assigned_at)
    select v_event_id, v_category_id, registration_id, bib_number,
      coalesce(v_prefix, '') || bib_number::text, v_prefix, 'active', 'bulk', p_assigned_by, now()
    from requested
    returning id, registration_id, bib_number, bib_code
  )
  select array_agg(id order by bib_number) into v_bib_ids from inserted;

  insert into public.registration_activity (registration_id, action, actor, metadata)
  select r.registration_id, 'bib_assigned', p_assigned_by,
    jsonb_build_object('bib_id', i.id, 'bib_number', i.bib_number, 'assignment_source', 'bulk')
  from public.bibs i join public.registrations r on r.id = i.registration_id
  where i.id = any(v_bib_ids);
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, new_values)
  values (p_assigned_by, v_organization_id, v_event_id, 'bib_bulk_assigned', 'bib',
    (select jsonb_agg(jsonb_build_object('bib_id', id, 'registration_id', registration_id, 'bib_number', bib_number, 'bib_code', bib_code)) from public.bibs where id = any(v_bib_ids)));
  return v_bib_ids;
end;
$$;

revoke execute on function private.assign_bibs_bulk(uuid[], integer, uuid)
  from public, anon, authenticated;
grant execute on function private.assign_bibs_bulk(uuid[], integer, uuid)
  to service_role;

create or replace function public.assign_bibs_bulk(
  p_registration_ids uuid[],
  p_start_number integer,
  p_assigned_by uuid
)
returns uuid[]
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.assign_bibs_bulk(p_registration_ids, p_start_number, p_assigned_by);
$$;

revoke execute on function public.assign_bibs_bulk(uuid[], integer, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_bibs_bulk(uuid[], integer, uuid)
  to service_role;
