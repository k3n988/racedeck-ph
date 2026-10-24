-- Event publication is a reviewed transition, never a client-controlled field edit.
-- Organizer event writes use the server-side service role. Authenticated clients
-- retain SELECT access through the existing tenant-scoped RLS policies.
revoke insert, update, delete on public.events from public, anon, authenticated;
grant select, insert, update, delete on public.events to service_role;

-- The service role is used by server routes, so keep reviewed public details
-- immutable even if an upload and a review happen concurrently.
create or replace function public.guard_reviewed_event_details()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (old.lifecycle_status <> 'draft' or old.review_status in ('pending_review', 'approved'))
     and row(
       new.name, new.slug, new.description, new.logo_url, new.banner_url,
       new.venue, new.address, new.latitude, new.longitude, new.event_date,
       new.start_time, new.assembly_time, new.gun_start_time, new.cutoff_time,
       new.social_links
     ) is distinct from row(
       old.name, old.slug, old.description, old.logo_url, old.banner_url,
       old.venue, old.address, old.latitude, old.longitude, old.event_date,
       old.start_time, old.assembly_time, old.gun_start_time, old.cutoff_time,
       old.social_links
     ) then
    raise exception 'Reviewed event details cannot be changed';
  end if;
  if old.lifecycle_status = 'draft' and old.review_status in ('pending_review', 'approved')
     and row(new.registration_opens_at, new.registration_closes_at, new.overall_capacity)
       is distinct from row(old.registration_opens_at, old.registration_closes_at, old.overall_capacity) then
    raise exception 'Reviewed registration settings cannot be changed';
  end if;
  if old.lifecycle_status = 'draft' and new.lifecycle_status = 'published' and old.review_status <> 'approved' then
    raise exception 'Event must be approved before publication';
  end if;
  return new;
end;
$$;

create trigger guard_reviewed_event_details
before update on public.events
for each row execute function public.guard_reviewed_event_details();

-- Hold the event row while changing reviewed configuration so a submission
-- cannot race with an edit to the material an admin is reviewing.
create or replace function public.guard_event_review_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
begin
  if tg_op = 'DELETE' then
    v_event_id := old.event_id;
  elsif tg_op = 'UPDATE' then
    if old.event_id <> new.event_id then
      raise exception 'Moving event configuration between events is not allowed';
    end if;
    v_event_id := new.event_id;
  else
    v_event_id := new.event_id;
  end if;
  select * into v_event from public.events where id = v_event_id for update;
  if v_event.lifecycle_status = 'draft' and v_event.review_status in ('pending_review', 'approved') then
    raise exception 'Event configuration is locked during review and after approval';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_nested_event_review_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_status public.event_review_status;
  v_lifecycle public.event_lifecycle_status;
begin
  if tg_table_name = 'event_registration_field_options' then
    if tg_op = 'DELETE' then
      select event_id into v_event_id from public.event_registration_fields where id = old.field_id;
    else
      select event_id into v_event_id from public.event_registration_fields where id = new.field_id;
    end if;
  else
    if tg_op = 'DELETE' then
      select event_id into v_event_id from public.race_kit_configs where id = old.config_id;
    else
      select event_id into v_event_id from public.race_kit_configs where id = new.config_id;
    end if;
  end if;
  select review_status, lifecycle_status into v_status, v_lifecycle
    from public.events where id = v_event_id for update;
  if v_lifecycle = 'draft' and v_status in ('pending_review', 'approved') then
    raise exception 'Event configuration is locked during review and after approval';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guard_registration_option_review_snapshot
before insert or update or delete on public.event_registration_field_options
for each row execute function public.guard_nested_event_review_snapshot();
create trigger guard_race_kit_item_review_snapshot
before insert or update or delete on public.race_kit_items
for each row execute function public.guard_nested_event_review_snapshot();

-- Recheck the booking window at the database boundary so an in-flight
-- checkout cannot reserve a slot after registration closes.
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
  select * into v_event from public.events where id = new.event_id for share;
  select * into v_category from public.race_categories where id = new.category_id and event_id = new.event_id for share;
  if not found or v_event.id is null
    or v_event.lifecycle_status <> 'published' or v_event.review_status <> 'approved'
    or v_event.registration_availability <> 'open' or v_category.registration_availability <> 'open'
    or (v_event.registration_opens_at is not null and now() < v_event.registration_opens_at)
    or (v_event.registration_closes_at is not null and now() >= v_event.registration_closes_at) then
    raise exception 'Registration is not currently available';
  end if;
  return new;
end;
$$;

create trigger guard_registration_hold_window
before insert on public.registration_holds
for each row execute function public.guard_registration_hold_window();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'event_schedules', 'event_routes', 'event_partners', 'race_categories',
    'event_registration_fields', 'event_waivers', 'event_content_images', 'race_kit_configs'
  ] loop
    execute format(
      'create trigger guard_event_review_snapshot before insert or update or delete on public.%I for each row execute function public.guard_event_review_snapshot()',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.submit_event_for_review(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_organization public.organizations%rowtype;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if not private.has_org_permission(v_event.organization_id, 'submit_events', p_event_id) then
    raise exception 'Submit events permission required';
  end if;
  select * into v_organization from public.organizations where id = v_event.organization_id;
  if v_organization.verification_status <> 'approved' or v_organization.account_status <> 'active' then
    raise exception 'Organization must be approved and active';
  end if;
  if v_event.lifecycle_status <> 'draft' or v_event.review_status not in ('not_submitted', 'needs_changes', 'rejected') then
    raise exception 'Event cannot be submitted in its current state';
  end if;
  if nullif(btrim(v_event.name), '') is null or nullif(btrim(coalesce(v_event.description, '')), '') is null
     or nullif(btrim(coalesce(v_event.address, '')), '') is null then
    raise exception 'Event name, description, and address are required';
  end if;
  if v_event.registration_opens_at is null or v_event.registration_closes_at is null
     or v_event.registration_opens_at >= v_event.registration_closes_at then
    raise exception 'Valid registration opening and closing dates are required';
  end if;
  if v_event.event_date < (now() at time zone 'Asia/Manila')::date
     or v_event.registration_closes_at > ((v_event.event_date + 1)::timestamp at time zone 'Asia/Manila') then
    raise exception 'Event date must be upcoming and registration must close by the end of event day';
  end if;
  if not exists (select 1 from public.race_categories where event_id = p_event_id) then
    raise exception 'Add at least one race category before submission';
  end if;

  update public.events
     set review_status = 'pending_review', review_feedback = null, updated_at = now()
   where id = p_event_id;
  insert into public.event_review_history (event_id, from_status, to_status, reviewed_by)
  values (p_event_id, v_event.review_status, 'pending_review', auth.uid());
  return 'pending_review';
end;
$$;

create or replace function public.review_event(
  p_event_id uuid,
  p_decision public.event_review_status,
  p_feedback text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_review_id uuid;
  v_title text;
begin
  if not (private.has_internal_role('admin') or private.has_internal_role('super_admin')) then
    raise exception 'RaceDeck admin permission required';
  end if;
  if p_decision not in ('approved', 'needs_changes', 'rejected') then
    raise exception 'Invalid review decision';
  end if;
  if p_decision <> 'approved' and nullif(btrim(coalesce(p_feedback, '')), '') is null then
    raise exception 'Feedback is required for this decision';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.review_status <> 'pending_review' or v_event.lifecycle_status <> 'draft' then
    raise exception 'Event is not pending review';
  end if;
  if p_decision = 'approved' and not exists (
    select 1 from public.organizations
     where id = v_event.organization_id and verification_status = 'approved' and account_status = 'active'
  ) then
    raise exception 'Organizer is not approved and active';
  end if;
  if p_decision = 'approved' and not exists (select 1 from public.race_categories where event_id = p_event_id) then
    raise exception 'Event must have a race category before approval';
  end if;

  update public.events
     set review_status = p_decision, review_feedback = nullif(btrim(p_feedback), ''), updated_at = now()
   where id = p_event_id;
  insert into public.event_review_history (event_id, from_status, to_status, feedback, reviewed_by)
  values (p_event_id, v_event.review_status, p_decision, nullif(btrim(p_feedback), ''), auth.uid())
  returning id into v_review_id;
  v_title := case p_decision
    when 'approved' then 'Event approved'
    when 'needs_changes' then 'Event needs changes'
    else 'Event rejected'
  end;
  insert into public.audit_logs
    (actor_user_id, actor_role_context, organization_id, event_id, action, resource_type, resource_id, previous_values, new_values)
  values
    (auth.uid(), 'racedeck_admin', v_event.organization_id, p_event_id, 'event_reviewed', 'event', p_event_id,
     jsonb_build_object('review_status', v_event.review_status),
     jsonb_build_object('review_status', p_decision, 'feedback', nullif(btrim(p_feedback), '')));
  with created as (
    insert into public.notifications
      (recipient_user_id, organization_id, event_id, notification_type, title, body, metadata, idempotency_key)
    select m.user_id, v_event.organization_id, p_event_id, 'event_review_result', v_title,
      format('%s: %s%s', v_event.name, v_title,
        case when p_feedback is null or btrim(p_feedback) = '' then '' else E'\n' || btrim(p_feedback) end),
      jsonb_build_object('review_id', v_review_id, 'decision', p_decision::text),
      format('event-review:%s:%s', v_review_id, m.user_id)
    from public.organization_members m
    where m.organization_id = v_event.organization_id and m.role = 'owner' and m.is_active
    on conflict do nothing
    returning id, recipient_user_id
  )
  insert into public.notification_deliveries
    (notification_id, recipient_user_id, channel, idempotency_key)
  select id, recipient_user_id, 'in_app', format('event-review:%s:%s:in-app', v_review_id, recipient_user_id)
  from created;
  return p_decision::text;
end;
$$;

create or replace function public.publish_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_availability public.registration_availability_status;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if not private.has_org_permission(v_event.organization_id, 'submit_events', p_event_id) then
    raise exception 'Submit events permission required';
  end if;
  if v_event.lifecycle_status <> 'draft' or v_event.review_status <> 'approved' then
    raise exception 'Only an approved draft can be published';
  end if;
  if v_event.event_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'A past event cannot be published';
  end if;
  if not exists (
    select 1 from public.organizations
     where id = v_event.organization_id and verification_status = 'approved' and account_status = 'active'
  ) then
    raise exception 'Organizer is not approved and active';
  end if;
  if not exists (select 1 from public.race_categories where event_id = p_event_id) then
    raise exception 'Event has no race categories';
  end if;

  -- Checkout checks both timestamps, and guard_registration_hold_window
  -- rechecks them when the slot is reserved. This stored status represents
  -- organizer intent; effective public availability still follows the dates.
  v_availability := 'open';
  update public.events
     set lifecycle_status = 'published', registration_availability = v_availability, updated_at = now()
   where id = p_event_id;
  update public.race_categories
     set registration_availability = case
       when max_slots is not null and confirmed_count >= max_slots then 'sold_out'::public.registration_availability_status
       else v_availability
     end, updated_at = now()
   where event_id = p_event_id;
  insert into public.event_status_history (event_id, from_status, to_status, changed_by)
  values (p_event_id, v_event.lifecycle_status, 'published', auth.uid());
  return 'published';
end;
$$;

revoke all on function public.submit_event_for_review(uuid) from public;
revoke all on function public.review_event(uuid, public.event_review_status, text) from public;
revoke all on function public.publish_event(uuid) from public;
grant execute on function public.submit_event_for_review(uuid) to authenticated;
grant execute on function public.review_event(uuid, public.event_review_status, text) to authenticated;
grant execute on function public.publish_event(uuid) to authenticated;

-- Public discovery filters and pagination use the same effective availability
-- that checkout enforces. The view is read only through the server service role.
create or replace view public.event_discovery
with (security_invoker = true)
as
select
  e.id, e.organization_id, e.slug, e.name, e.banner_url, e.event_date,
  e.venue, e.address, e.social_links, e.registration_opens_at,
  e.registration_closes_at, e.is_featured,
  case
    when e.registration_availability in ('sold_out', 'closed', 'not_yet_open') then e.registration_availability
    when e.registration_opens_at is not null and now() < e.registration_opens_at then 'not_yet_open'::public.registration_availability_status
    when e.registration_closes_at is not null and now() >= e.registration_closes_at then 'closed'::public.registration_availability_status
    else 'open'::public.registration_availability_status
  end as registration_availability
from public.events e
where e.lifecycle_status in ('published', 'ongoing', 'completed')
  and e.review_status = 'approved';

revoke all on public.event_discovery from public, anon, authenticated;
grant select on public.event_discovery to service_role;
notify pgrst, 'reload schema';
