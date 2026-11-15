-- Automatic and organizer-managed bib allocation. Default bands are derived
-- from integer category distances: distance_km * 10,000 + 1 through +9,999.
-- Examples: 3K = 30001, 5K = 50001, 10K = 100001, 21K = 210001.
-- Non-integer, duplicate, out-of-range, or conflicting categories use the
-- event-unique fallback band starting at 900000001.

create table public.bib_assignment_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  bib_id uuid references public.bibs(id) on delete set null,
  bib_number integer not null check (bib_number > 0),
  previous_bib_number integer check (previous_bib_number is null or previous_bib_number > 0),
  assignment_source public.bib_assignment_source not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  change_reason text not null default 'assigned'
);

alter table public.bib_assignment_history enable row level security;
revoke all on public.bib_assignment_history from public, anon, authenticated;
grant all on public.bib_assignment_history to service_role;
create unique index bib_assignment_history_event_number_uidx
  on public.bib_assignment_history(event_id, bib_number);
create index bib_assignment_history_registration_time_idx
  on public.bib_assignment_history(registration_id, changed_at desc);

-- Preserve all existing non-void assignments as reserved event numbers.
insert into public.bib_assignment_history (
  event_id, registration_id, bib_id, bib_number, assignment_source,
  changed_by, changed_at, change_reason
)
select event_id, registration_id, id, bib_number,
  coalesce(assignment_source, 'manual'::public.bib_assignment_source),
  assigned_by, coalesce(assigned_at, created_at), 'existing_assignment'
from public.bibs
where registration_id is not null and status <> 'void'
on conflict (event_id, bib_number) do nothing;

create or replace function public.record_bib_assignment_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and (
    tg_op = 'INSERT' or old.status <> 'active' or old.bib_number is distinct from new.bib_number
  ) then
    insert into public.bib_assignment_history (
      event_id, registration_id, bib_id, bib_number, previous_bib_number,
      assignment_source, changed_by, changed_at, change_reason
    ) values (
      new.event_id, new.registration_id, new.id, new.bib_number,
      case when tg_op = 'UPDATE' and old.status = 'active' then old.bib_number else null end,
      coalesce(new.assignment_source, 'manual'::public.bib_assignment_source),
      new.assigned_by, coalesce(new.assigned_at, now()),
      case when tg_op = 'UPDATE' and old.status = 'active' then 'bib_number_changed' else 'assigned' end
    );
  end if;
  return new;
end;
$$;

create trigger bibs_record_assignment_history
  after insert or update of status, bib_number on public.bibs
  for each row execute function public.record_bib_assignment_history();

create or replace function public.validate_bib_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_category_prefix text;
begin
  select rc.bib_prefix into v_category_prefix
  from public.race_categories rc
  where rc.id = new.category_id and rc.event_id = new.event_id;
  if not found then raise exception 'bib category must belong to its event'; end if;

  if new.registration_id is not null and not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id and r.event_id = new.event_id and r.category_id = new.category_id
  ) then
    raise exception 'bib registration must match its event and category';
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if new.registration_id is null then raise exception 'active bibs require a registration'; end if;
    if not exists (
      select 1 from public.registrations r
      where r.id = new.registration_id and r.event_id = new.event_id
        and r.category_id = new.category_id and r.status = 'confirmed'
    ) then
      raise exception 'active bibs require a confirmed registration';
    end if;
    if not public.registration_has_succeeded_payment(new.registration_id) then
      raise exception 'active bibs require successful payment';
    end if;
    if new.assignment_source is null then raise exception 'active bibs require an assignment source'; end if;
  end if;

  if v_category_prefix is not null and new.prefix is distinct from v_category_prefix then
    raise exception 'bib prefix must match the category prefix';
  end if;
  return new;
end;
$$;

create or replace function public.registration_has_succeeded_payment(p_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.payments p
    where p.status = 'succeeded'
      and (
        p.registration_id = p_registration_id
        or coalesce(p.metadata->'registration_ids', '[]'::jsonb) @> jsonb_build_array(p_registration_id::text)
      )
  );
$$;
revoke execute on function public.registration_has_succeeded_payment(uuid) from public, anon, authenticated;
grant execute on function public.registration_has_succeeded_payment(uuid) to service_role;

create or replace function private.assign_next_bib(
  p_registration_id uuid,
  p_assigned_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_event_id uuid;
  v_category_id uuid;
  v_existing_bib_id uuid;
  v_registration_number text;
  v_registration_status public.registration_status;
  v_distance numeric;
  v_category_count integer;
  v_prefix text;
  v_start bigint;
  v_end bigint;
  v_next_number integer;
  v_bib_id uuid;
  v_organization_id uuid;
  v_fallback boolean := false;
  v_assignment_source public.bib_assignment_source;
begin
  select r.event_id into v_event_id from public.registrations r where r.id = p_registration_id;
  if not found then raise exception 'registration not found'; end if;
  perform 1 from public.events e where e.id = v_event_id for update;
  select r.category_id, r.bib_id, r.registration_number, r.status, rc.distance_km, rc.bib_prefix
    into v_category_id, v_existing_bib_id, v_registration_number,
      v_registration_status, v_distance, v_prefix
  from public.registrations r
  join public.race_categories rc on rc.id = r.category_id and rc.event_id = r.event_id
  where r.id = p_registration_id
  for update of r;
  if not found then raise exception 'registration not found'; end if;

  if v_existing_bib_id is not null and exists (
    select 1 from public.bibs b where b.id = v_existing_bib_id and b.status = 'active'
  ) then return v_existing_bib_id; end if;
  select b.id into v_existing_bib_id from public.bibs b
    where b.registration_id = p_registration_id and b.status = 'active' limit 1;
  if v_existing_bib_id is not null then return v_existing_bib_id; end if;
  if v_registration_status <> 'confirmed' then raise exception 'bib assignment requires a confirmed registration'; end if;
  if not public.registration_has_succeeded_payment(p_registration_id) then raise exception 'bib assignment requires successful payment'; end if;
  v_assignment_source := case when p_assigned_by is null then 'sequential'::public.bib_assignment_source else 'bulk'::public.bib_assignment_source end;

  select e.organization_id into v_organization_id from public.events e where e.id = v_event_id;

  select count(*) into v_category_count from public.race_categories rc
  where rc.event_id = v_event_id and rc.distance_km = v_distance;
  if v_distance is null or v_distance <= 0 or v_distance <> trunc(v_distance)
     or v_distance > 9999 or v_category_count <> 1 then
    v_fallback := true;
  else
    v_start := (v_distance::bigint * 10000) + 1;
    v_end := v_start + 9998;
    if exists (
      select 1 from public.race_categories rc
      where rc.event_id = v_event_id and rc.id <> v_category_id
        and rc.bib_range_start is not null and rc.bib_range_end is not null
        and rc.bib_range_start <= v_end and rc.bib_range_end >= v_start
    ) or exists (
      select 1 from public.bibs b
      where b.event_id = v_event_id and b.status = 'active'
        and b.category_id <> v_category_id and b.bib_number between v_start and v_end
    ) then
      v_fallback := true;
    end if;
  end if;

  if not v_fallback then
    select s.n into v_next_number
    from generate_series(v_start, v_end) as s(n)
    where not exists (
      select 1 from public.bib_assignment_history h
      where h.event_id = v_event_id and h.bib_number = s.n
    )
    order by s.n limit 1;
    if v_next_number is null then v_fallback := true; end if;
  end if;

  if v_fallback then
    v_next_number := 900000001;
    while exists (
      select 1 from public.bib_assignment_history h
      where h.event_id = v_event_id and h.bib_number = v_next_number
    ) loop
      if v_next_number >= 2147483647 then raise exception 'no event-unique bib numbers remain'; end if;
      v_next_number := v_next_number + 1;
    end loop;
  end if;

  insert into public.bibs (
    event_id, category_id, registration_id, bib_number, bib_code, prefix,
    status, assignment_source, assigned_by, assigned_at
  ) values (
    v_event_id, v_category_id, p_registration_id, v_next_number,
    coalesce(v_prefix, '') || v_next_number::text, v_prefix,
    'active', v_assignment_source, p_assigned_by, now()
  ) returning id into v_bib_id;

  insert into public.registration_activity (registration_id, action, actor, metadata)
  values (p_registration_id, 'bib_assigned', p_assigned_by,
    jsonb_build_object('bib_id', v_bib_id, 'bib_number', v_next_number, 'assignment_source', v_assignment_source));
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, resource_id, new_values)
  values (p_assigned_by, v_organization_id, v_event_id,
    case when v_assignment_source = 'bulk' then 'bib_bulk_assigned' else 'bib_auto_assigned' end,
    'bib', v_bib_id,
    jsonb_build_object('registration_id', p_registration_id, 'registration_number', v_registration_number, 'bib_number', v_next_number, 'category_id', v_category_id, 'assignment_source', v_assignment_source));
  return v_bib_id;
end;
$$;
revoke execute on function private.assign_next_bib(uuid, uuid) from public, anon, authenticated;
grant execute on function private.assign_next_bib(uuid, uuid) to service_role;

create or replace function public.confirm_registration(p_registration_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_event_id uuid;
  v_category_id uuid;
  v_max_slots integer;
  v_confirmed_count integer;
  v_current_status public.registration_status;
begin
  perform set_config('racedeck.payment_state_write', 'on', true);
  select r.event_id into v_event_id from public.registrations r where r.id = p_registration_id;
  if not found then return false; end if;
  perform 1 from public.events e where e.id = v_event_id for update;
  select r.event_id, r.category_id, r.status into v_event_id, v_category_id, v_current_status
  from public.registrations r where r.id = p_registration_id for update;
  if not found then return false; end if;
  if v_current_status = 'confirmed' then
    if public.registration_has_succeeded_payment(p_registration_id) then
      perform private.assign_next_bib(p_registration_id, null);
    end if;
    return true;
  end if;
  if not public.registration_has_succeeded_payment(p_registration_id) then
    raise exception 'registration cannot be confirmed without successful payment';
  end if;
  select rc.max_slots, rc.confirmed_count into v_max_slots, v_confirmed_count
  from public.race_categories rc where rc.id = v_category_id for update;
  if v_max_slots is not null and v_confirmed_count >= v_max_slots then return false; end if;
  update public.registrations set status = 'confirmed', updated_at = now() where id = p_registration_id;
  update public.race_categories set confirmed_count = confirmed_count + 1,
    registration_availability = case when max_slots is not null and confirmed_count + 1 >= max_slots
      then 'sold_out'::public.registration_availability_status else registration_availability end
  where id = v_category_id;
  insert into public.registration_status_history (registration_id, from_status, to_status)
    values (p_registration_id, v_current_status, 'confirmed');
  insert into public.registration_activity (registration_id, action)
    values (p_registration_id, 'payment_confirmed');
  perform private.assign_next_bib(p_registration_id, null);
  return true;
end;
$$;
revoke execute on function public.confirm_registration(uuid) from public, anon, authenticated;
grant execute on function public.confirm_registration(uuid) to service_role;

create or replace function public.assign_manual_bib(
  p_event_id uuid, p_registration_id uuid, p_bib_number integer, p_assigned_by uuid
)
returns public.bibs
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_registration public.registrations;
  v_category public.race_categories;
  v_organization_id uuid;
  v_bib public.bibs;
begin
  if p_bib_number is null or p_bib_number <= 0 or p_assigned_by is null then raise exception 'enter a valid bib number'; end if;
  perform 1 from public.events e where e.id = p_event_id for update;
  select e.organization_id into v_organization_id from public.events e where e.id = p_event_id;
  select * into v_registration from public.registrations r where r.id = p_registration_id and r.event_id = p_event_id for update;
  if not found then raise exception 'registration does not belong to this event'; end if;
  if v_registration.status <> 'confirmed' then raise exception 'bib assignment requires a confirmed registration'; end if;
  if not public.registration_has_succeeded_payment(p_registration_id) then raise exception 'bib assignment requires successful payment'; end if;
  if v_registration.bib_id is not null or exists (select 1 from public.bibs b where b.registration_id = p_registration_id and b.status = 'active') then
    raise exception 'registration already has an active bib';
  end if;
  select * into v_category from public.race_categories rc where rc.id = v_registration.category_id and rc.event_id = p_event_id;
  if not found then raise exception 'race category was not found'; end if;
  insert into public.bibs (event_id, category_id, registration_id, bib_number, bib_code, prefix, status, assignment_source, assigned_by, assigned_at)
  values (p_event_id, v_category.id, p_registration_id, p_bib_number,
    coalesce(v_category.bib_prefix, '') || p_bib_number::text, v_category.bib_prefix,
    'active', 'manual', p_assigned_by, now()) returning * into v_bib;
  insert into public.registration_activity (registration_id, action, actor, metadata)
    values (p_registration_id, 'bib_assigned', p_assigned_by,
      jsonb_build_object('bib_id', v_bib.id, 'bib_number', v_bib.bib_number, 'assignment_source', 'manual'));
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, resource_id, new_values)
    values (p_assigned_by, v_organization_id, p_event_id, 'bib_assigned', 'bib', v_bib.id,
      jsonb_build_object('registration_id', p_registration_id, 'bib_number', v_bib.bib_number, 'bib_code', v_bib.bib_code));
  return v_bib;
end;
$$;
revoke execute on function public.assign_manual_bib(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.assign_manual_bib(uuid, uuid, integer, uuid) to service_role;

create or replace function public.reassign_event_bib(
  p_event_id uuid, p_bib_id uuid, p_bib_number integer, p_changed_by uuid,
  p_confirm_claimed_correction boolean default false
)
returns public.bibs
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_bib public.bibs;
  v_updated public.bibs;
  v_event_org uuid;
  v_claimed boolean;
  v_has_results boolean;
  v_action text;
begin
  if p_bib_number is null or p_bib_number <= 0 or p_changed_by is null then raise exception 'enter a valid bib number'; end if;
  perform 1 from public.events e where e.id = p_event_id for update;
  select * into v_bib from public.bibs b where b.id = p_bib_id and b.event_id = p_event_id and b.status = 'active' for update;
  if not found then raise exception 'active bib was not found for this event'; end if;
  if v_bib.bib_number = p_bib_number then return v_bib; end if;
  if not exists (select 1 from public.registrations r where r.id = v_bib.registration_id and r.status = 'confirmed')
     or not public.registration_has_succeeded_payment(v_bib.registration_id) then
    raise exception 'bib editing requires a confirmed registration with successful payment';
  end if;
  select exists(select 1 from public.race_kit_claims c where c.bib_id = v_bib.id) into v_claimed;
  if v_claimed and not p_confirm_claimed_correction then
    raise exception 'participant already collected the race kit; confirm the audited bib correction';
  end if;
  select exists(select 1 from public.results r where r.bib_id = v_bib.id) into v_has_results;
  if v_has_results then raise exception 'this bib is used by published or recorded results and cannot be changed'; end if;
  select e.organization_id into v_event_org from public.events e where e.id = p_event_id;
  update public.bibs set bib_number = p_bib_number,
    bib_code = coalesce(prefix, '') || p_bib_number::text,
    assignment_source = 'reassignment', assigned_by = p_changed_by, assigned_at = now()
  where id = v_bib.id returning * into v_updated;
  v_action := case when v_claimed then 'bib_corrected_after_race_kit_claim' else 'bib_reassigned' end;
  insert into public.registration_activity (registration_id, action, actor, metadata)
    values (v_bib.registration_id, v_action, p_changed_by,
      jsonb_build_object('bib_id', v_bib.id, 'previous_bib_number', v_bib.bib_number, 'new_bib_number', v_updated.bib_number, 'claimed_kit_correction', v_claimed));
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, resource_id, previous_values, new_values)
    values (p_changed_by, v_event_org, p_event_id, v_action, 'bib', v_bib.id,
      jsonb_build_object('bib_number', v_bib.bib_number, 'bib_code', v_bib.bib_code),
      jsonb_build_object('bib_number', v_updated.bib_number, 'bib_code', v_updated.bib_code, 'registration_id', v_bib.registration_id, 'claimed_kit_correction', v_claimed));
  return v_updated;
end;
$$;
revoke execute on function public.reassign_event_bib(uuid, uuid, integer, uuid, boolean) from public, anon, authenticated;
grant execute on function public.reassign_event_bib(uuid, uuid, integer, uuid, boolean) to service_role;

create or replace function public.assign_missing_event_bibs(p_event_id uuid, p_assigned_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_registration record;
  v_assigned integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if p_assigned_by is null then raise exception 'an authorized staff member is required'; end if;
  perform 1 from public.events e where e.id = p_event_id for update;
  if not found then raise exception 'event was not found'; end if;
  for v_registration in
    select r.id, r.registration_number
    from public.registrations r
    where r.event_id = p_event_id and r.status = 'confirmed'
      and r.bib_id is null
      and not exists (select 1 from public.bibs b where b.registration_id = r.id and b.status = 'active')
      and public.registration_has_succeeded_payment(r.id)
    order by r.category_id, r.registration_number, r.id
    for update of r
  loop
    begin
      perform private.assign_next_bib(v_registration.id, p_assigned_by);
      v_assigned := v_assigned + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('registration_number', v_registration.registration_number, 'error', sqlerrm));
    end;
  end loop;
  select v_skipped + count(*)::integer into v_skipped
  from public.registrations r
  where r.event_id = p_event_id and (
    r.status <> 'confirmed'
    or not public.registration_has_succeeded_payment(r.id)
    or r.bib_id is not null
    or exists (select 1 from public.bibs b where b.registration_id = r.id and b.status = 'active')
  );
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, new_values)
    select p_assigned_by, e.organization_id, p_event_id, 'bib_missing_assignments_completed', 'bib',
      jsonb_build_object('assigned', v_assigned, 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors)
    from public.events e where e.id = p_event_id;
  return jsonb_build_object('assigned', v_assigned, 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors);
end;
$$;
revoke execute on function public.assign_missing_event_bibs(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_missing_event_bibs(uuid, uuid) to service_role;

create or replace function public.bib_management_page(
  p_event_id uuid, p_search text default '', p_category_id uuid default null,
  p_registration_type text default 'all', p_payment_status text default 'all',
  p_assignment_status text default 'all', p_page integer default 1, p_page_size integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with participant_rows as materialized (
  select r.id, r.registration_number, r.user_id,
    concat_ws(' ', r.first_name, r.middle_name, r.last_name) as participant_name,
    r.first_name, r.middle_name, r.last_name, r.status as registration_status,
    r.category_id, rc.name as category_name, rc.distance_km,
    case when r.user_id is null then 'guest' else 'account' end as registration_type,
    payment.status::text as payment_status,
    bib.id as bib_id, bib.bib_number, bib.bib_code, bib.assignment_source::text as assignment_source,
    case when bib.assignment_source in ('sequential', 'bulk') then 'automatic'
      when bib.assignment_source in ('manual', 'reassignment') then 'manual' else null end as assignment_type,
    bib.assigned_at, bib.status::text as bib_status,
    exists (select 1 from public.race_kit_claims claim where claim.registration_id = r.id) as kit_claimed
  from public.registrations r
  join public.race_categories rc on rc.id = r.category_id and rc.event_id = r.event_id
  left join lateral (
    select p.status from public.payments p
    where p.event_id = r.event_id and p.status is not null
      and (p.registration_id = r.id or coalesce(p.metadata->'registration_ids', '[]'::jsonb) @> jsonb_build_array(r.id::text))
    order by (p.registration_id = r.id) desc, p.created_at desc limit 1
  ) payment on true
  left join public.bibs bib on bib.id = r.bib_id and bib.status = 'active'
  where r.event_id = p_event_id
), filtered as materialized (
  select * from participant_rows p
  where (p_category_id is null or p.category_id = p_category_id)
    and (p_registration_type = 'all' or p.registration_type = p_registration_type)
    and (p_payment_status = 'all' or p.payment_status is not distinct from p_payment_status)
    and (p_assignment_status = 'all'
      or (p_assignment_status = 'assigned' and p.bib_id is not null)
      or (p_assignment_status = 'unassigned' and p.bib_id is null)
      or (p_assignment_status = 'automatic' and p.assignment_type = 'automatic')
      or (p_assignment_status = 'manual' and p.assignment_type = 'manual'))
    and (nullif(btrim(p_search), '') is null or p.participant_name ilike '%' || p_search || '%'
      or p.registration_number ilike '%' || p_search || '%' or p.id::text ilike '%' || p_search || '%'
      or p.bib_number::text ilike '%' || p_search || '%' or p.bib_code ilike '%' || p_search || '%')
), total_count as (select count(*)::integer as total from filtered), eligible_count as (
  select count(*)::integer as total from participant_rows p
  where p.registration_status = 'confirmed' and p.payment_status = 'succeeded' and p.bib_id is null
)
select jsonb_build_object(
  'total', (select total from total_count),
  'eligible_missing_count', (select total from eligible_count),
  'page', greatest(1, least(p_page, greatest(1, ceil((select total from total_count)::numeric / p_page_size)::integer))),
  'page_size', p_page_size,
  'total_pages', greatest(1, ceil((select total from total_count)::numeric / p_page_size)::integer),
  'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', row.id, 'registration_number', row.registration_number, 'participant_name', row.participant_name,
      'first_name', row.first_name, 'middle_name', row.middle_name, 'last_name', row.last_name,
      'registration_status', row.registration_status,
      'category_id', row.category_id, 'category_name', row.category_name, 'distance_km', row.distance_km,
      'registration_type', row.registration_type, 'payment_status', row.payment_status,
      'kit_claimed', row.kit_claimed,
      'bib', case when row.bib_id is null then null else jsonb_build_object('id', row.bib_id, 'bib_number', row.bib_number, 'bib_code', row.bib_code, 'assignment_source', row.assignment_source, 'assignment_type', row.assignment_type, 'assigned_at', row.assigned_at) end
    ) order by row.category_name, row.registration_number)
    from (
      select f.* from filtered f order by f.category_name, f.registration_number
      offset (greatest(1, least(p_page, greatest(1, ceil((select total from total_count)::numeric / p_page_size)::integer))) - 1) * p_page_size
      limit p_page_size
    ) row
  ), '[]'::jsonb)
);
$$;
revoke execute on function public.bib_management_page(uuid, text, uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.bib_management_page(uuid, text, uuid, text, text, text, integer, integer) to service_role;
