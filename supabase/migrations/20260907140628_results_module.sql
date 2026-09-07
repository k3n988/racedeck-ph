-- RaceDeck Results module
-- Result imports are server-side workflows. A published batch is immutable;
-- corrections are made by importing and validating a new batch.

create type result_batch_validation_status as enum ('pending', 'validating', 'valid', 'invalid');
create type result_batch_publication_status as enum ('draft', 'published');
create type result_row_validation_status as enum ('pending', 'valid', 'invalid', 'unmatched');
create type participant_result_status as enum ('finished', 'dnf', 'dns', 'dq');

create table public.result_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  imported_by uuid not null references auth.users(id) on delete restrict,
  source_filename text not null,
  storage_reference text,
  imported_at timestamptz not null default now(),
  validation_status result_batch_validation_status not null default 'pending',
  publication_status result_batch_publication_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  row_count integer not null default 0,
  valid_row_count integer not null default 0,
  invalid_row_count integer not null default 0,
  unmatched_row_count integer not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_batches_filename_not_blank check (btrim(source_filename) <> ''),
  constraint result_batches_counts_nonnegative check (
    row_count >= 0 and valid_row_count >= 0 and invalid_row_count >= 0 and unmatched_row_count >= 0
  ),
  constraint result_batches_counts_consistent check (
    valid_row_count + invalid_row_count <= row_count
    and unmatched_row_count <= row_count
  ),
  constraint result_batches_publication_metadata check (
    (publication_status = 'draft' and published_at is null and published_by is null)
    or (publication_status = 'published' and published_at is not null and published_by is not null)
  ),
  constraint result_batches_published_must_validate check (
    publication_status = 'draft' or validation_status = 'valid'
  )
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  result_batch_id uuid not null references public.result_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid references public.registrations(id) on delete restrict,
  participant_id uuid references auth.users(id) on delete set null,
  race_category_id uuid references public.race_categories(id) on delete restrict,
  bib_id uuid references public.bibs(id) on delete restrict,
  participant_display_name text,
  category_name text,
  bib_code text,
  bib_number integer,
  gun_time interval,
  chip_time interval,
  overall_rank integer,
  classification_rank integer,
  category_rank integer,
  result_status participant_result_status not null,
  validation_status result_row_validation_status not null default 'pending',
  validation_errors jsonb not null default '{}'::jsonb,
  source_row_number integer,
  source_bib text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint results_display_name_not_blank check (
    participant_display_name is null or btrim(participant_display_name) <> ''
  ),
  constraint results_category_name_not_blank check (category_name is null or btrim(category_name) <> ''),
  constraint results_bib_code_not_blank check (bib_code is null or btrim(bib_code) <> ''),
  constraint results_bib_number_positive check (bib_number is null or bib_number > 0),
  constraint results_source_row_positive check (source_row_number is null or source_row_number > 0),
  constraint results_source_bib_not_blank check (source_bib is null or btrim(source_bib) <> ''),
  constraint results_times_nonnegative check (
    (gun_time is null or extract(epoch from gun_time) >= 0)
    and (chip_time is null or extract(epoch from chip_time) >= 0)
  ),
  constraint results_ranks_positive check (
    (overall_rank is null or overall_rank > 0)
    and (classification_rank is null or classification_rank > 0)
    and (category_rank is null or category_rank > 0)
  ),
  constraint results_finished_has_gun_time check (
    result_status <> 'finished' or gun_time is not null
  ),
  constraint results_valid_row_complete check (
    validation_status <> 'valid'
    or (registration_id is not null and race_category_id is not null
      and bib_id is not null and participant_display_name is not null and category_name is not null
      and bib_code is not null and bib_number is not null)
  ),
  constraint results_batch_registration_unique unique (result_batch_id, registration_id)
);

create index result_batches_org_idx on public.result_batches (organization_id);
create index result_batches_event_publication_idx
  on public.result_batches (event_id, publication_status, published_at desc);
create index result_batches_imported_by_idx on public.result_batches (imported_by);
create index results_batch_idx on public.results (result_batch_id);
create index results_org_event_idx on public.results (organization_id, event_id);
create index results_event_registration_idx on public.results (event_id, registration_id);
create index results_event_bib_idx on public.results (event_id, bib_code);
create index results_event_bib_number_idx on public.results (event_id, bib_number);
create index results_event_participant_idx on public.results (event_id, participant_id);
create index results_event_category_rank_idx
  on public.results (event_id, race_category_id, category_rank);
create index results_registration_idx on public.results (registration_id);
create index results_validation_status_idx on public.results (result_batch_id, validation_status);
create unique index results_batch_bib_unique_idx
  on public.results (result_batch_id, bib_id)
  where bib_id is not null;

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

  if tg_op = 'UPDATE' and old.publication_status = 'published' then
    raise exception 'Published result batches are immutable; import a correction as a new batch';
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
            and p.key = 'publish_results'
        ) then
        raise exception 'Publishing results requires publish_results permission';
      end if;
    end if;
    if tg_op = 'INSERT' or old.publication_status <> 'published' then
      -- Serialize publication of batches for an event, so cross-batch checks
      -- cannot race with another concurrent publication.
      perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));

      if exists (
        select 1 from public.results r
        where r.result_batch_id = new.id
          and (r.validation_status <> 'valid' or r.registration_id is null or r.bib_id is null)
      ) then
        raise exception 'Published result batches may contain only complete valid results';
      end if;

      select count(*)::integer,
        count(*) filter (where r.validation_status = 'valid')::integer,
        count(*) filter (where r.validation_status = 'invalid')::integer,
        count(*) filter (where r.validation_status = 'unmatched')::integer
      into v_row_count, v_valid_row_count, v_invalid_row_count, v_unmatched_row_count
      from public.results r
      where r.result_batch_id = new.id;
      if new.row_count <> v_row_count
        or new.valid_row_count <> v_valid_row_count
        or new.invalid_row_count <> v_invalid_row_count
        or new.unmatched_row_count <> v_unmatched_row_count then
        raise exception 'Result batch counters do not match its rows';
      end if;

      select exists (
        select 1
        from public.results r
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
      if v_duplicate then raise exception 'A registration already has a published result for this event'; end if;

      if exists (
        select 1
        from public.results r
        join public.result_batches other_batch on other_batch.id = r.result_batch_id
        where r.result_batch_id <> new.id
          and other_batch.event_id = new.event_id
          and other_batch.publication_status = 'published'
          and r.validation_status = 'valid'
          and exists (
            select 1 from public.results current_result
            where current_result.result_batch_id = new.id
              and current_result.bib_id = r.bib_id
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
    raise exception 'Published result rows are immutable';
  end if;

  if new.registration_id is not null then
    select * into v_registration from public.registrations where id = new.registration_id;
    if not found or v_registration.event_id <> new.event_id then
      raise exception 'Result registration does not belong to the result event';
    end if;
    if new.participant_id is distinct from v_registration.user_id then
      raise exception 'Result participant does not match registration';
    end if;
    if new.race_category_id is distinct from v_registration.category_id then
      raise exception 'Result category does not match registration';
    end if;
    if new.participant_display_name is not null
      and new.participant_display_name <> nullif(btrim(concat_ws(' ', v_registration.first_name, v_registration.last_name)), '') then
      raise exception 'Result participant snapshot does not match registration';
    end if;
  elsif new.participant_id is not null or new.race_category_id is not null then
    raise exception 'Unmatched results cannot have participant or category references';
  end if;

  if new.race_category_id is not null then
    select * into v_category from public.race_categories where id = new.race_category_id;
    if not found or v_category.event_id <> new.event_id then
      raise exception 'Result category does not belong to the result event';
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
  return new;
end;
$$;

create trigger result_batches_validate_trigger
  before insert or update on public.result_batches
  for each row execute function private.validate_result_batch();

create trigger results_validate_trigger
  before insert or update on public.results
  for each row execute function private.validate_result_row();

create trigger result_batches_updated_at_trigger
  before update on public.result_batches
  for each row execute function public.set_payment_updated_at();

create trigger results_updated_at_trigger
  before update on public.results
  for each row execute function public.set_payment_updated_at();

create or replace function private.prevent_published_result_batch_delete()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if old.publication_status = 'published' then
    raise exception 'Published result batches cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger result_batches_prevent_published_delete_trigger
  before delete on public.result_batches
  for each row execute function private.prevent_published_result_batch_delete();

alter table public.result_batches enable row level security;
alter table public.results enable row level security;

create policy "Public can view published result batches"
  on public.result_batches for select
  to anon, authenticated
  using (publication_status = 'published');

create policy "Result managers can view organization batches"
  on public.result_batches for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = result_batches.event_id
        and e.organization_id = result_batches.organization_id
        and exists (
          select 1 from public.organization_members om
          join public.role_permissions rp on rp.role = om.role
          join public.permissions p on p.id = rp.permission_id
          where om.organization_id = e.organization_id
            and om.user_id = (select auth.uid())
            and om.is_active = true
            and p.key in ('upload_results', 'publish_results')
        )
    )
  );

create policy "Result uploaders can create organization batches"
  on public.result_batches for insert
  to authenticated
  with check (
    imported_by = (select auth.uid())
    and exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = result_batches.event_id
        and e.organization_id = result_batches.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key = 'upload_results'
    )
  );

create policy "Result managers can update organization batches"
  on public.result_batches for update
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = result_batches.event_id
        and e.organization_id = result_batches.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key in ('upload_results', 'publish_results')
    )
  )
  with check (organization_id = (select organization_id from public.events where id = event_id));

create policy "Result uploaders can delete draft batches"
  on public.result_batches for delete
  to authenticated
  using (
    publication_status = 'draft'
    and exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = result_batches.event_id and e.organization_id = result_batches.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true and p.key = 'upload_results'
    )
  );

create policy "Public can view published valid results"
  on public.results for select
  to anon, authenticated
  using (
    validation_status = 'valid'
    and exists (
      select 1 from public.result_batches b
      where b.id = results.result_batch_id and b.publication_status = 'published'
    )
  );

create policy "Result managers can view organization results"
  on public.results for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = results.event_id and e.organization_id = results.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key in ('upload_results', 'publish_results')
    )
  );

create policy "Result uploaders can create results"
  on public.results for insert
  to authenticated
  with check (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = results.event_id and e.organization_id = results.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true and p.key = 'upload_results'
    )
  );

create policy "Result uploaders can update results"
  on public.results for update
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = results.event_id and e.organization_id = results.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true and p.key = 'upload_results'
    )
  )
  with check (organization_id = (select organization_id from public.events where id = event_id));

create policy "Result uploaders can delete results"
  on public.results for delete
  to authenticated
  using (
    exists (select 1 from public.result_batches b
      where b.id = results.result_batch_id and b.publication_status = 'draft')
    and exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where e.id = results.event_id and e.organization_id = results.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true and p.key = 'upload_results'
    )
  );

-- Keep public/anonymous result access to the minimal display fields. Authenticated
-- staff access remains row-scoped by RLS; server-side service-role workflows can
-- access the full import/validation payload.
revoke all on public.result_batches from public, anon;
grant select (id, event_id, publication_status) on public.result_batches to anon;
revoke all on public.results from public, anon;
grant select (
  id, event_id, race_category_id, participant_display_name, category_name,
  bib_code, bib_number, gun_time, chip_time, overall_rank,
  classification_rank, category_rank, result_status
) on public.results to anon;

grant select, insert, update, delete on public.result_batches to authenticated;
grant select, insert, update, delete on public.results to authenticated;
