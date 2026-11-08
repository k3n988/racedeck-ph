-- Keep the database checkout guard aligned with the schedule-aware availability
-- shown by RaceDeck. The stored enum is an organizer override; when a schedule
-- exists, its opening and closing timestamps determine the effective window.
create or replace function public.guard_registration_hold_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_category public.race_categories%rowtype;
begin
  if new.status <> 'active' then return new; end if;

  select * into v_event
  from public.events
  where id = new.event_id
  for share;

  select * into v_category
  from public.race_categories
  where id = new.category_id and event_id = new.event_id
  for share;

  if not found or v_event.id is null
    or v_event.lifecycle_status <> 'published'
    or v_event.review_status <> 'approved'
    or v_event.registration_availability in ('closed', 'sold_out')
    or (v_event.registration_availability = 'not_yet_open' and v_event.registration_opens_at is null)
    or (v_event.registration_opens_at is not null and now() < v_event.registration_opens_at)
    or (v_event.registration_closes_at is not null and now() >= v_event.registration_closes_at)
    or now() >= ((v_event.event_date + 1)::timestamp at time zone 'Asia/Manila')
    or v_category.registration_availability in ('closed', 'sold_out')
    or (v_category.max_slots is not null and v_category.confirmed_count >= v_category.max_slots) then
    raise exception 'Registration is not currently available';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
