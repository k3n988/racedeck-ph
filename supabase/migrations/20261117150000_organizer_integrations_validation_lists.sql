create table public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  google_analytics_id text,
  meta_pixel_id text,
  updated_at timestamptz not null default now(),
  constraint organization_integrations_ga_id_format
    check (google_analytics_id is null or google_analytics_id ~ '^G-[A-Z0-9]{5,20}$'),
  constraint organization_integrations_meta_pixel_id_format
    check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{5,20}$')
);

alter table public.organization_integrations enable row level security;
create policy organization_integrations_owner_read
  on public.organization_integrations for select to authenticated
  using (exists (select 1 from public.organization_members om
    where om.organization_id = organization_integrations.organization_id
      and om.user_id = (select auth.uid()) and om.role = 'owner' and om.is_active));
create policy organization_integrations_owner_write
  on public.organization_integrations for all to authenticated
  using (exists (select 1 from public.organization_members om
    where om.organization_id = organization_integrations.organization_id
      and om.user_id = (select auth.uid()) and om.role = 'owner' and om.is_active))
  with check (exists (select 1 from public.organization_members om
    where om.organization_id = organization_integrations.organization_id
      and om.user_id = (select auth.uid()) and om.role = 'owner' and om.is_active));

create table public.organization_validation_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  options jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(options) = 'array'
      then jsonb_array_length(options) between 1 and 100
      else false end),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index organization_validation_lists_organization_id_idx
  on public.organization_validation_lists(organization_id);
alter table public.organization_validation_lists enable row level security;
create policy organization_validation_lists_scoped_access
  on public.organization_validation_lists for all to authenticated
  using (private.has_org_permission(organization_id, 'edit_events'))
  with check (private.has_org_permission(organization_id, 'edit_events'));

alter table public.event_registration_fields
  add column validation_list_id uuid references public.organization_validation_lists(id) on delete set null;
create index event_registration_fields_validation_list_id_idx
  on public.event_registration_fields(validation_list_id);

grant select, insert, update, delete on public.organization_integrations,
  public.organization_validation_lists to service_role;
grant update on public.event_registration_fields to service_role;

create function public.apply_registration_validation_list(
  p_event_id uuid,
  p_field_id uuid,
  p_list_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_options jsonb;
  v_field_type text;
  v_response_count integer;
  v_option_count integer;
begin
  select e.organization_id, f.field_type::text, l.options
    into v_organization_id, v_field_type, v_options
  from public.events e
  join public.event_registration_fields f on f.event_id = e.id and f.id = p_field_id
  join public.organization_validation_lists l on l.id = p_list_id and l.organization_id = e.organization_id
  where e.id = p_event_id;

  if v_organization_id is null then
    raise exception 'Question or validation list not found for this event';
  end if;
  if v_field_type not in ('dropdown', 'multi_select', 'radio') then
    raise exception 'Validation lists require a choice question';
  end if;
  select count(*) into v_response_count
    from public.registration_responses where field_id = p_field_id;
  if v_response_count > 0 then
    raise exception 'Question options are locked because participant responses already exist';
  end if;

  delete from public.event_registration_field_options where field_id = p_field_id;
  insert into public.event_registration_field_options (field_id, label, value, display_order)
  select p_field_id, item.label, item.value, item.ordinality - 1
  from jsonb_to_recordset(v_options) with ordinality as item(label text, value text, ordinality bigint);
  get diagnostics v_option_count = row_count;

  update public.event_registration_fields
  set validation_list_id = p_list_id
  where id = p_field_id and event_id = p_event_id;
  return v_option_count;
end;
$$;
revoke all on function public.apply_registration_validation_list(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_registration_validation_list(uuid, uuid, uuid) to service_role;
