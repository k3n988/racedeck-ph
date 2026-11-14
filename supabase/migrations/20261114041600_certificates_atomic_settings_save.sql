-- Keep certificate settings and their category eligibility rows in one
-- transaction. The table constraints validate the selected categories at
-- commit, so separate REST requests cannot safely replace this configuration.
insert into public.certificate_templates (
  name,
  is_system_template,
  certificate_title,
  layout_config,
  version,
  status
)
values (
  'RaceDeck Finisher',
  true,
  'Certificate of Completion',
  '{}'::jsonb,
  1,
  'active'
)
on conflict do nothing;

-- Give existing events the same default reminder schedule that new event
-- creation inserts. Reminders whose send time has already passed stay off.
insert into public.event_reminder_settings (
  organization_id,
  event_id,
  reminder_key,
  reminder_type,
  lead_time_minutes,
  enabled,
  instructions,
  custom_schedule_at
)
select
  e.organization_id,
  e.id,
  reminder.reminder_key,
  reminder.reminder_type,
  reminder.lead_time_minutes,
  (e.event_date::timestamp at time zone 'Asia/Manila') - make_interval(mins => reminder.lead_time_minutes) > now(),
  null,
  null
from public.events e
cross join (values
  ('7_days_before', 'race_reminder'::public.reminder_type, 10080),
  ('3_days_before', 'race_reminder'::public.reminder_type, 4320),
  ('1_day_before', 'race_tomorrow'::public.reminder_type, 1440)
) as reminder(reminder_key, reminder_type, lead_time_minutes)
on conflict (event_id, reminder_key) do nothing;

create or replace function public.save_event_certificate_settings(
  p_event_id uuid,
  p_organization_id uuid,
  p_settings jsonb,
  p_category_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_settings_id uuid;
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organization_id = p_organization_id
  ) then
    raise exception 'Event does not belong to this organization';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_category_ids, array[]::uuid[])) as selected(category_id)
    left join public.race_categories c
      on c.id = selected.category_id and c.event_id = p_event_id
    where c.id is null
  ) then
    raise exception 'One or more categories do not belong to this event';
  end if;

  if coalesce((p_settings ->> 'enabled')::boolean, false)
    and p_settings ->> 'eligibility_mode' = 'finished_selected_categories'
    and coalesce(array_length(p_category_ids, 1), 0) = 0 then
    raise exception 'Select at least one eligible category';
  end if;

  insert into public.event_certificate_settings (
    event_id,
    organization_id,
    enabled,
    template_id,
    certificate_title,
    event_logo_reference,
    organizer_logo_reference,
    sponsor_logo_config,
    signature_image_reference,
    signatory_name,
    signatory_position,
    certificate_message,
    eligibility_mode
  ) values (
    p_event_id,
    p_organization_id,
    coalesce((p_settings ->> 'enabled')::boolean, false),
    nullif(p_settings ->> 'template_id', '')::uuid,
    nullif(p_settings ->> 'certificate_title', ''),
    nullif(p_settings ->> 'event_logo_reference', ''),
    nullif(p_settings ->> 'organizer_logo_reference', ''),
    case
      when p_settings ? 'sponsor_logo_config' and p_settings -> 'sponsor_logo_config' <> 'null'::jsonb
        then p_settings -> 'sponsor_logo_config'
      else '[]'::jsonb
    end,
    nullif(p_settings ->> 'signature_image_reference', ''),
    nullif(p_settings ->> 'signatory_name', ''),
    nullif(p_settings ->> 'signatory_position', ''),
    nullif(p_settings ->> 'certificate_message', ''),
    coalesce(nullif(p_settings ->> 'eligibility_mode', '')::public.certificate_eligibility_mode, 'finished_all')
  )
  on conflict (event_id) do update set
    organization_id = excluded.organization_id,
    enabled = excluded.enabled,
    template_id = excluded.template_id,
    certificate_title = excluded.certificate_title,
    event_logo_reference = excluded.event_logo_reference,
    organizer_logo_reference = excluded.organizer_logo_reference,
    sponsor_logo_config = excluded.sponsor_logo_config,
    signature_image_reference = excluded.signature_image_reference,
    signatory_name = excluded.signatory_name,
    signatory_position = excluded.signatory_position,
    certificate_message = excluded.certificate_message,
    eligibility_mode = excluded.eligibility_mode
  returning id into v_settings_id;

  delete from public.event_certificate_categories
  where settings_id = v_settings_id;

  insert into public.event_certificate_categories (settings_id, race_category_id)
  select v_settings_id, selected.category_id
  from unnest(coalesce(p_category_ids, array[]::uuid[])) as selected(category_id);

  return v_settings_id;
end;
$$;

revoke all on function public.save_event_certificate_settings(uuid, uuid, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.save_event_certificate_settings(uuid, uuid, jsonb, uuid[]) to service_role;
