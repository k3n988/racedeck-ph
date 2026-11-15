-- Allocate fixed-width bib codes by whole-kilometer distance.
-- The numeric bib_number remains an integer (so distances under 10 km have a
-- leading zero only in bib_code, e.g. 3 km -> 03001). Each distance band has
-- 999 numbers: DD001-DD999. Unsupported/full bands use a reserved five-digit
-- fallback pool (00001-00999), never the former nine-digit range.

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

  if v_distance is null or v_distance < 1 or v_distance > 99 or v_distance <> trunc(v_distance) then
    v_fallback := true;
  else
    v_start := (v_distance::bigint * 1000) + 1;
    v_end := v_start + 998;
    if exists (
      select 1 from public.race_categories rc
      where rc.event_id = v_event_id and rc.id <> v_category_id
        and rc.bib_range_start is not null and rc.bib_range_end is not null
        and rc.bib_range_start <= v_end and rc.bib_range_end >= v_start
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
    and not exists (
      select 1 from public.bibs b
      where b.event_id = v_event_id and b.status <> 'void' and b.bib_number = s.n
    )
    order by s.n limit 1;
    if v_next_number is null then v_fallback := true; end if;
  end if;

  if v_fallback then
    select s.n into v_next_number
    from generate_series(1, 999) as s(n)
    where not exists (
      select 1 from public.bib_assignment_history h
      where h.event_id = v_event_id and h.bib_number = s.n
    )
    and not exists (
      select 1 from public.bibs b
      where b.event_id = v_event_id and b.status <> 'void' and b.bib_number = s.n
    )
    and not exists (
      select 1 from public.race_categories rc
      where rc.event_id = v_event_id
        and rc.bib_range_start is not null and rc.bib_range_end is not null
        and s.n between rc.bib_range_start and rc.bib_range_end
    )
    order by s.n limit 1;
    if v_next_number is null then raise exception 'no five-digit bib numbers remain for this event'; end if;
  end if;

  insert into public.bibs (
    event_id, category_id, registration_id, bib_number, bib_code, prefix,
    status, assignment_source, assigned_by, assigned_at
  ) values (
    v_event_id, v_category_id, p_registration_id, v_next_number,
    coalesce(v_prefix, '') || lpad(v_next_number::text, 5, '0'), v_prefix,
    'active', v_assignment_source, p_assigned_by, now()
  ) returning id into v_bib_id;

  insert into public.registration_activity (registration_id, action, actor, metadata)
  values (p_registration_id, 'bib_assigned', p_assigned_by,
    jsonb_build_object('bib_id', v_bib_id, 'bib_number', v_next_number, 'assignment_source', v_assignment_source));
  insert into public.audit_logs (actor_user_id, organization_id, event_id, action, resource_type, resource_id, new_values)
  values (p_assigned_by, v_organization_id, v_event_id,
    case when v_assignment_source = 'bulk' then 'bib_bulk_assigned' else 'bib_auto_assigned' end,
    'bib', v_bib_id,
    jsonb_build_object('registration_id', p_registration_id, 'registration_number', v_registration_number, 'bib_number', v_next_number, 'bib_code', coalesce(v_prefix, '') || lpad(v_next_number::text, 5, '0'), 'category_id', v_category_id, 'distance_km', v_distance, 'assignment_source', v_assignment_source));
  return v_bib_id;
end;
$$;

revoke execute on function private.assign_next_bib(uuid, uuid) from public, anon, authenticated;
grant execute on function private.assign_next_bib(uuid, uuid) to service_role;

-- Ensure bibs assigned manually or edited by an organizer also display as a
-- five-digit number after any category prefix. Existing historical bibs are
-- left untouched.
create or replace function public.format_bib_code_five_digits()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.bib_number > 99999 then raise exception 'new bib numbers must fit a five-digit code'; end if;
  elsif old.bib_number is distinct from new.bib_number and new.bib_number > 99999 then
    raise exception 'new bib numbers must fit a five-digit code';
  end if;
  new.bib_code := coalesce(new.prefix, '') || lpad(new.bib_number::text, 5, '0');
  return new;
end;
$$;

create trigger bibs_format_code_five_digits
before insert or update of bib_number, prefix on public.bibs
for each row execute function public.format_bib_code_five_digits();

revoke execute on function public.format_bib_code_five_digits() from public, anon, authenticated;
grant execute on function public.format_bib_code_five_digits() to service_role;
