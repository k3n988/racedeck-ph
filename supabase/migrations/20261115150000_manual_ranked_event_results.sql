-- Manual, event-scoped ranked results. Existing result_batches/results stay the
-- canonical storage and legacy CSV batches remain readable.

alter table public.result_batches
  add column race_category_id uuid references public.race_categories(id) on delete restrict,
  add column division text,
  add column winner_limit integer,
  add column entry_mode text not null default 'csv';

alter table public.result_batches
  add constraint result_batches_division_check
    check (division is null or division in ('male', 'female', 'overall')),
  add constraint result_batches_winner_limit_check
    check (winner_limit is null or winner_limit between 1 and 100),
  add constraint result_batches_entry_mode_check
    check (entry_mode in ('csv', 'manual')),
  add constraint result_batches_manual_group_fields_check
    check (entry_mode <> 'manual' or (race_category_id is not null and division is not null and winner_limit is not null));

create unique index result_batches_manual_group_unique_idx
  on public.result_batches (event_id, race_category_id, division)
  where entry_mode = 'manual';

create index result_batches_category_division_idx
  on public.result_batches (event_id, race_category_id, division, publication_status)
  where race_category_id is not null;

create index registrations_result_search_idx
  on public.registrations (event_id, category_id, status, registration_number);

create unique index results_batch_rank_unique_idx
  on public.results (result_batch_id, category_rank)
  where category_rank is not null;

alter table public.results drop constraint results_valid_row_complete;
alter table public.results add constraint results_valid_row_complete check (
  validation_status <> 'valid'
  or (registration_id is not null and race_category_id is not null
    and participant_display_name is not null and category_name is not null)
);

alter table public.results drop constraint results_finished_has_gun_time;
alter table public.results add constraint results_finished_time_nonnegative check (
  gun_time is null or extract(epoch from gun_time) >= 0
);

create table public.event_result_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  result_batch_id uuid,
  action text not null check (action in ('created', 'updated', 'published', 'unpublished', 'deleted')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index event_result_audit_event_created_idx
  on public.event_result_audit_logs (event_id, created_at desc);
create index event_result_audit_batch_created_idx
  on public.event_result_audit_logs (result_batch_id, created_at desc);

alter table public.event_result_audit_logs enable row level security;
revoke all on public.event_result_audit_logs from public, anon;
grant select on public.event_result_audit_logs to authenticated;
create policy "Result managers can view event result audit history"
  on public.event_result_audit_logs for select to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = event_result_audit_logs.event_id
        and om.user_id = (select auth.uid())
        and om.is_active = true
        and (om.restricted_event_ids is null or e.id = any(om.restricted_event_ids))
        and p.key in ('upload_results', 'publish_results')
    )
  );

create or replace function private.validate_result_batch()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_duplicate boolean;
  v_row_count integer;
  v_valid_row_count integer;
  v_invalid_row_count integer;
  v_unmatched_row_count integer;
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'Result batch event does not belong to organization';
  end if;

  if new.race_category_id is not null and not exists (
    select 1 from public.race_categories c
    where c.id = new.race_category_id and c.event_id = new.event_id
  ) then
    raise exception 'Result group category does not belong to event';
  end if;

  if tg_op = 'UPDATE' and old.publication_status = 'published' then
    if new.publication_status <> 'draft' or new.published_at is not null or new.published_by is not null then
      raise exception 'Unpublish a result group before editing it';
    end if;
    if (select auth.uid()) is not null
      and not exists (
        select 1 from public.organization_members om
        join public.role_permissions rp on rp.role = om.role
        join public.permissions p on p.id = rp.permission_id
        where om.organization_id = new.organization_id
          and om.user_id = (select auth.uid()) and om.is_active = true
          and (om.restricted_event_ids is null or new.event_id = any(om.restricted_event_ids))
          and p.key = 'publish_results'
      )
      and not exists (
        select 1 from public.racedeck_internal_user_roles r
        where r.user_id = (select auth.uid()) and r.is_active = true and r.role in ('admin', 'super_admin')
      ) then
      raise exception 'Unpublishing results requires publish_results permission';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.imported_by is distinct from old.imported_by then
    raise exception 'Result batch importer is immutable';
  end if;

  if new.publication_status = 'draft' then
    if new.published_at is not null or new.published_by is not null then
      raise exception 'Draft result batches cannot have publication metadata';
    end if;
  else
    if new.validation_status <> 'valid' then
      raise exception 'Only a valid result batch can be published';
    end if;
    if (select auth.uid()) is not null then
      if new.published_by is distinct from (select auth.uid())
        or not exists (
          select 1
          from public.organization_members om
          join public.role_permissions rp on rp.role = om.role
          join public.permissions p on p.id = rp.permission_id
          where om.organization_id = new.organization_id
            and om.user_id = (select auth.uid())
            and om.is_active = true
            and (om.restricted_event_ids is null or new.event_id = any(om.restricted_event_ids))
            and p.key = 'publish_results'
        ) then
        raise exception 'Publishing results requires publish_results permission';
      end if;
    end if;
    if tg_op = 'INSERT' or old.publication_status <> 'published' then
      perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));

      if exists (
        select 1 from public.results r
        where r.result_batch_id = new.id
          and (r.validation_status <> 'valid' or r.registration_id is null)
      ) then
        raise exception 'Published result batches may contain only complete valid results';
      end if;

      select count(*)::integer,
        count(*) filter (where r.validation_status = 'valid')::integer,
        count(*) filter (where r.validation_status = 'invalid')::integer,
        count(*) filter (where r.validation_status = 'unmatched')::integer
      into v_row_count, v_valid_row_count, v_invalid_row_count, v_unmatched_row_count
      from public.results r where r.result_batch_id = new.id;
      if new.row_count <> v_row_count
        or new.valid_row_count <> v_valid_row_count
        or new.invalid_row_count <> v_invalid_row_count
        or new.unmatched_row_count <> v_unmatched_row_count then
        raise exception 'Result batch counters do not match its rows';
      end if;

      if new.entry_mode = 'manual' then
        select exists (
          select 1 from public.results r
          join public.result_batches other_batch on other_batch.id = r.result_batch_id
          where r.result_batch_id <> new.id
            and other_batch.event_id = new.event_id
            and other_batch.entry_mode = 'manual'
            and other_batch.publication_status = 'published'
            and other_batch.race_category_id = new.race_category_id
            and other_batch.division = new.division
            and r.validation_status = 'valid'
            and exists (
              select 1 from public.results current_result
              where current_result.result_batch_id = new.id
                and current_result.registration_id = r.registration_id
            )
        ) into v_duplicate;
      else
        select exists (
          select 1 from public.results r
          join public.result_batches other_batch on other_batch.id = r.result_batch_id
          where r.result_batch_id <> new.id
            and other_batch.event_id = new.event_id
            and other_batch.publication_status = 'published'
            and r.validation_status = 'valid'
            and exists (
              select 1 from public.results current_result
              where current_result.result_batch_id = new.id
                and current_result.registration_id = r.registration_id
            )
        ) into v_duplicate;
      end if;
      if v_duplicate then raise exception 'A participant already has a published result in this group'; end if;

      if new.entry_mode <> 'manual' and exists (
        select 1 from public.results r
        join public.result_batches other_batch on other_batch.id = r.result_batch_id
        where r.result_batch_id <> new.id
          and other_batch.event_id = new.event_id
          and other_batch.publication_status = 'published'
          and r.validation_status = 'valid'
          and r.bib_id is not null
          and exists (
            select 1 from public.results current_result
            where current_result.result_batch_id = new.id and current_result.bib_id = r.bib_id
          )
      ) then
        raise exception 'A bib already has a published result for this event';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_result_row()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_batch public.result_batches%rowtype;
  v_registration public.registrations%rowtype;
  v_category public.race_categories%rowtype;
  v_bib public.bibs%rowtype;
begin
  select * into v_batch from public.result_batches where id = new.result_batch_id;
  if not found then raise exception 'Result batch does not exist'; end if;
  if new.organization_id <> v_batch.organization_id or new.event_id <> v_batch.event_id then
    raise exception 'Result scope does not match its batch';
  end if;
  if v_batch.publication_status = 'published' then
    raise exception 'Unpublish the result group before editing entries';
  end if;

  if new.registration_id is not null then
    select * into v_registration from public.registrations where id = new.registration_id;
    if not found or v_registration.event_id <> new.event_id then
      raise exception 'Result registration does not belong to the result event';
    end if;
    if v_registration.status = 'cancelled' then
      raise exception 'Cancelled registrations cannot be result winners';
    end if;
    if new.participant_id is distinct from v_registration.user_id then
      raise exception 'Result participant does not match registration';
    end if;
    if new.race_category_id is distinct from v_registration.category_id then
      raise exception 'Result category does not match registration';
    end if;
    if new.participant_display_name is not null
      and new.participant_display_name <> nullif(btrim(concat_ws(' ', v_registration.first_name, v_registration.middle_name, v_registration.last_name)), '')
      and new.participant_display_name <> nullif(btrim(concat_ws(' ', v_registration.first_name, v_registration.last_name)), '') then
      raise exception 'Result participant snapshot does not match registration';
    end if;
    if v_batch.entry_mode = 'manual' and v_batch.division = 'male'
      and lower(btrim(coalesce(v_registration.gender, ''))) not in ('male', 'm', 'man') then
      raise exception 'Participant does not match the selected result division';
    end if;
    if v_batch.entry_mode = 'manual' and v_batch.division = 'female'
      and lower(btrim(coalesce(v_registration.gender, ''))) not in ('female', 'f', 'woman') then
      raise exception 'Participant does not match the selected result division';
    end if;
  elsif new.participant_id is not null or new.race_category_id is not null then
    raise exception 'Unmatched results cannot have participant or category references';
  end if;

  if new.race_category_id is not null then
    select * into v_category from public.race_categories where id = new.race_category_id;
    if not found or v_category.event_id <> new.event_id then
      raise exception 'Result category does not belong to category event';
    end if;
    if v_batch.race_category_id is not null and new.race_category_id <> v_batch.race_category_id then
      raise exception 'Result entry category does not match its result group';
    end if;
    if new.category_name is not null and new.category_name <> v_category.name then
      raise exception 'Result category snapshot does not match category';
    end if;
  end if;

  if new.bib_id is not null then
    select * into v_bib from public.bibs where id = new.bib_id;
    if not found or v_bib.event_id <> new.event_id then
      raise exception 'Result bib does not belong to the result event';
    end if;
    if new.registration_id is not null and v_bib.registration_id is distinct from new.registration_id then
      raise exception 'Result bib does not belong to registration';
    end if;
    if new.bib_code is not null and new.bib_code <> v_bib.bib_code then
      raise exception 'Result bib snapshot does not match bib';
    end if;
    if new.bib_number is not null and new.bib_number <> v_bib.bib_number then
      raise exception 'Result bib number snapshot does not match bib';
    end if;
  end if;
  if v_batch.entry_mode = 'manual' and (new.validation_status = 'valid' and new.category_rank is null) then
    raise exception 'Manual result entries require a rank';
  end if;
  return new;
end;
$$;

create or replace function public.save_manual_result_group(
  p_event_id uuid,
  p_group_id uuid,
  p_race_category_id uuid,
  p_division text,
  p_winner_limit integer,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
  v_category public.race_categories%rowtype;
  v_group public.result_batches%rowtype;
  v_entry jsonb;
  v_registration public.registrations%rowtype;
  v_bib public.bibs%rowtype;
  v_rank integer;
  v_time text;
  v_gun_time interval;
  v_entry_count integer;
  v_before jsonb;
  v_after jsonb;
  v_internal boolean;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_division not in ('male', 'female', 'overall') then raise exception 'Choose a supported division'; end if;
  if p_winner_limit not between 1 and 100 then raise exception 'Winner count must be between 1 and 100'; end if;
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then raise exception 'Entries must be a list'; end if;
  v_entry_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));
  if v_entry_count > p_winner_limit then raise exception 'Winner entries exceed the configured winner count'; end if;

  select e.organization_id into v_organization_id from public.events e where e.id = p_event_id;
  if v_organization_id is null then raise exception 'Event not found'; end if;
  select * into v_category from public.race_categories c where c.id = p_race_category_id and c.event_id = p_event_id;
  if not found then raise exception 'Choose a race category belonging to this event'; end if;
  if p_division = 'male' and not exists (
    select 1 from public.registrations r where r.event_id = p_event_id and r.status <> 'cancelled'
      and lower(btrim(coalesce(r.gender, ''))) in ('male', 'm', 'man')
  ) then raise exception 'Male division is not supported by this event registration data'; end if;
  if p_division = 'female' and not exists (
    select 1 from public.registrations r where r.event_id = p_event_id and r.status <> 'cancelled'
      and lower(btrim(coalesce(r.gender, ''))) in ('female', 'f', 'woman')
  ) then raise exception 'Female division is not supported by this event registration data'; end if;

  select exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = v_actor and r.is_active = true and r.role in ('admin', 'super_admin')
  ) into v_internal;
  if not v_internal and not exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = v_organization_id
      and om.user_id = v_actor and om.is_active = true
      and (om.restricted_event_ids is null or p_event_id = any(om.restricted_event_ids))
      and p.key = 'upload_results'
  ) then raise exception 'Saving results requires upload_results permission'; end if;

  if exists (
    select 1 from public.result_batches b
    where b.event_id = p_event_id and b.race_category_id = p_race_category_id
      and b.division = p_division and b.entry_mode = 'manual'
      and b.id is distinct from p_group_id
  ) then raise exception 'A result group already exists for this category and division. Edit that group instead.'; end if;

  if p_group_id is not null then
    select * into v_group from public.result_batches b
    where b.id = p_group_id and b.event_id = p_event_id and b.entry_mode = 'manual'
    for update;
    if not found then raise exception 'Result group not found'; end if;
    if v_group.publication_status = 'published' and not v_internal and not exists (
      select 1 from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where om.organization_id = v_group.organization_id
        and om.user_id = v_actor and om.is_active = true
        and (om.restricted_event_ids is null or p_event_id = any(om.restricted_event_ids))
        and p.key = 'publish_results'
    ) then raise exception 'Editing published results requires publish_results permission'; end if;
    select jsonb_build_object(
      'division', b.division, 'winner_limit', b.winner_limit,
      'entries', coalesce((select jsonb_agg(jsonb_build_object('rank', r.category_rank, 'registration_id', r.registration_id, 'name', r.participant_display_name, 'bib', r.bib_code, 'finish_time', r.gun_time::text) order by r.category_rank) from public.results r where r.result_batch_id = b.id), '[]'::jsonb)
    ) into v_before from public.result_batches b where b.id = p_group_id;
    if v_group.publication_status = 'published' then
      update public.result_batches set publication_status = 'draft', published_at = null, published_by = null where id = p_group_id;
    end if;
    update public.result_batches set
      race_category_id = p_race_category_id,
      division = p_division,
      winner_limit = p_winner_limit,
      validation_status = 'valid',
      row_count = v_entry_count,
      valid_row_count = v_entry_count,
      invalid_row_count = 0,
      unmatched_row_count = 0,
      validation_summary = jsonb_build_object('input_mode', 'manual', 'entry_count', v_entry_count)
    where id = p_group_id;
    delete from public.results where result_batch_id = p_group_id;
    v_group.id := p_group_id;
  else
    insert into public.result_batches (
      organization_id, event_id, imported_by, source_filename, race_category_id,
      division, winner_limit, entry_mode, validation_status,
      row_count, valid_row_count, invalid_row_count, unmatched_row_count,
      validation_summary, metadata
    ) values (
      v_organization_id, p_event_id, v_actor, 'manual-results', p_race_category_id,
      p_division, p_winner_limit, 'manual', 'valid',
      v_entry_count, v_entry_count, 0, 0,
      jsonb_build_object('input_mode', 'manual', 'entry_count', v_entry_count),
      jsonb_build_object('input_mode', 'manual')
    ) returning * into v_group;
  end if;

  for v_entry in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    if coalesce(v_entry->>'registration_id', '') = '' then raise exception 'Choose a registered participant for each ranked entry'; end if;
    if coalesce(v_entry->>'rank', '') !~ '^\d+$' then raise exception 'Each result rank must be a whole number'; end if;
    v_rank := (v_entry->>'rank')::integer;
    if v_rank < 1 or v_rank > p_winner_limit then raise exception 'A result rank is outside the configured winner count'; end if;
    select * into v_registration from public.registrations r
    where r.id = (v_entry->>'registration_id')::uuid
      and r.event_id = p_event_id
      and r.category_id = p_race_category_id
      and r.status <> 'cancelled';
    if not found then raise exception 'Participant is not an eligible registration for this event category'; end if;
    if p_division = 'male' and lower(btrim(coalesce(v_registration.gender, ''))) not in ('male', 'm', 'man') then
      raise exception 'Participant does not match the selected division';
    end if;
    if p_division = 'female' and lower(btrim(coalesce(v_registration.gender, ''))) not in ('female', 'f', 'woman') then
      raise exception 'Participant does not match the selected division';
    end if;

    v_time := nullif(btrim(v_entry->>'finish_time'), '');
    v_gun_time := null;
    if v_time is not null then
      if v_time !~ '^\d{1,3}:[0-5]\d:[0-5]\d(\.\d{1,3})?$' then raise exception 'Finish time must use HH:MM:SS format'; end if;
      v_gun_time := v_time::interval;
    end if;

    select * into v_bib from public.bibs b
    where b.registration_id = v_registration.id and b.event_id = p_event_id and b.status = 'active'
    order by b.assigned_at desc nulls last, b.created_at desc limit 1;
    insert into public.results (
      result_batch_id, organization_id, event_id, registration_id, participant_id,
      race_category_id, bib_id, participant_display_name, category_name,
      bib_code, bib_number, gun_time, overall_rank, classification_rank,
      category_rank, result_status, validation_status, validation_errors, metadata
    ) values (
      v_group.id, v_organization_id, p_event_id, v_registration.id, v_registration.user_id,
      p_race_category_id, v_bib.id,
      nullif(btrim(concat_ws(' ', v_registration.first_name, v_registration.middle_name, v_registration.last_name)), ''),
      v_category.name, v_bib.bib_code, v_bib.bib_number, v_gun_time,
      v_rank, v_rank, v_rank, 'finished', 'valid', '{}'::jsonb,
      jsonb_build_object('input_mode', 'manual', 'division', p_division)
    );
  end loop;

  select jsonb_build_object(
    'division', b.division, 'winner_limit', b.winner_limit,
    'entries', coalesce((select jsonb_agg(jsonb_build_object('rank', r.category_rank, 'registration_id', r.registration_id, 'name', r.participant_display_name, 'bib', r.bib_code, 'finish_time', r.gun_time::text) order by r.category_rank) from public.results r where r.result_batch_id = b.id), '[]'::jsonb)
  ) into v_after from public.result_batches b where b.id = v_group.id;
  insert into public.event_result_audit_logs (organization_id, event_id, result_batch_id, action, actor_user_id, before_snapshot, after_snapshot)
  values (v_organization_id, p_event_id, v_group.id, case when v_before is null then 'created' else 'updated' end, v_actor, v_before, v_after);
  return v_group.id;
end;
$$;

create or replace function public.transition_manual_result_group(p_group_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_group public.result_batches%rowtype;
  v_internal boolean;
  v_permission text;
  v_count integer;
  v_min_rank integer;
  v_max_rank integer;
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_action not in ('publish', 'unpublish', 'delete') then raise exception 'Unsupported result group action'; end if;
  select * into v_group from public.result_batches b where b.id = p_group_id and b.entry_mode = 'manual' for update;
  if not found then raise exception 'Result group not found'; end if;
  v_permission := case when p_action in ('publish', 'unpublish') then 'publish_results' else 'upload_results' end;
  select exists (
    select 1 from public.racedeck_internal_user_roles r
    where r.user_id = v_actor and r.is_active = true and r.role in ('admin', 'super_admin')
  ) into v_internal;
  if not v_internal and not exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = v_group.organization_id
      and om.user_id = v_actor and om.is_active = true
      and (om.restricted_event_ids is null or v_group.event_id = any(om.restricted_event_ids))
      and p.key = v_permission
  ) then raise exception 'This action requires % permission', v_permission; end if;

  select jsonb_build_object(
    'category_id', v_group.race_category_id, 'division', v_group.division,
    'winner_limit', v_group.winner_limit, 'publication_status', v_group.publication_status,
    'entries', coalesce((select jsonb_agg(jsonb_build_object('rank', r.category_rank, 'registration_id', r.registration_id, 'name', r.participant_display_name, 'bib', r.bib_code, 'finish_time', r.gun_time::text) order by r.category_rank) from public.results r where r.result_batch_id = v_group.id), '[]'::jsonb)
  ) into v_snapshot;

  if p_action = 'publish' then
    select count(*)::integer, min(category_rank), max(category_rank)
    into v_count, v_min_rank, v_max_rank
    from public.results where result_batch_id = v_group.id and validation_status = 'valid';
    if v_count = 0 then raise exception 'Add at least one ranked participant before publishing'; end if;
    if v_count > v_group.winner_limit or v_min_rank <> 1 or v_max_rank <> v_count then
      raise exception 'Published ranks must be consecutive from first place and within the configured winner count';
    end if;
    update public.result_batches set publication_status = 'published', published_at = now(), published_by = v_actor,
      validation_status = 'valid', row_count = v_count, valid_row_count = v_count,
      invalid_row_count = 0, unmatched_row_count = 0
    where id = v_group.id;
  elsif p_action = 'unpublish' then
    if v_group.publication_status <> 'published' then raise exception 'Only published results can be unpublished'; end if;
    update public.result_batches set publication_status = 'draft', published_at = null, published_by = null where id = v_group.id;
  else
    if v_group.publication_status = 'published' then
      update public.result_batches set publication_status = 'draft', published_at = null, published_by = null where id = v_group.id;
    end if;
    delete from public.result_batches where id = v_group.id;
  end if;

  insert into public.event_result_audit_logs (organization_id, event_id, result_batch_id, action, actor_user_id, before_snapshot, after_snapshot)
  values (v_group.organization_id, v_group.event_id, v_group.id, p_action, v_actor, v_snapshot,
    case when p_action = 'delete' then null else v_snapshot || jsonb_build_object('publication_status', case when p_action = 'publish' then 'published' else 'draft' end) end);
  return jsonb_build_object('success', true, 'action', p_action, 'result_group_id', v_group.id);
end;
$$;

revoke all on function public.save_manual_result_group(uuid, uuid, uuid, text, integer, jsonb) from public, anon;
revoke all on function public.transition_manual_result_group(uuid, text) from public, anon;
grant execute on function public.save_manual_result_group(uuid, uuid, uuid, text, integer, jsonb) to authenticated;
grant execute on function public.transition_manual_result_group(uuid, text) to authenticated;

