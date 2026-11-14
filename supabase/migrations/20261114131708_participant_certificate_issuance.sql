-- Allow event organizers to issue participation certificates to every
-- confirmed registration, including participants without a published result.
alter table public.certificates alter column result_id drop not null;

alter table public.certificates drop constraint certificates_issued_requires_document;
alter table public.certificates add constraint certificates_issued_requires_document check (
  status <> 'issued' or document_storage_reference is not null or verification_path is not null
);

create or replace function private.validate_certificate_eligibility()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_result public.results%rowtype;
  v_batch public.result_batches%rowtype;
  v_registration public.registrations%rowtype;
  v_event public.events%rowtype;
  v_category public.race_categories%rowtype;
  v_settings public.event_certificate_settings%rowtype;
  v_template public.certificate_templates%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.certificate_reference <> old.certificate_reference
      or new.verification_token <> old.verification_token
      or new.organization_id <> old.organization_id
      or new.event_id <> old.event_id
      or new.registration_id <> old.registration_id
      or new.participant_id is distinct from old.participant_id
      or new.race_category_id <> old.race_category_id
      or new.result_id is distinct from old.result_id
      or new.bib_id is distinct from old.bib_id
      or new.template_id <> old.template_id
      or new.template_version <> old.template_version
      or new.template_snapshot <> old.template_snapshot
      or new.participant_name_snapshot <> old.participant_name_snapshot
      or new.event_name_snapshot <> old.event_name_snapshot
      or new.category_name_snapshot <> old.category_name_snapshot
      or new.event_date_snapshot <> old.event_date_snapshot
      or new.finish_time_snapshot is distinct from old.finish_time_snapshot
      or new.rank_snapshot is distinct from old.rank_snapshot
      or new.bib_code_snapshot is distinct from old.bib_code_snapshot
      or new.generated_at <> old.generated_at then
      raise exception 'Historical certificate identity and snapshots are immutable';
    end if;
    if old.status = 'revoked' and new.status <> 'revoked' then
      raise exception 'Revoked certificates cannot be reactivated';
    end if;
    if old.status = 'issued' and new.status = 'generated' then
      raise exception 'Issued certificates cannot return to generated state';
    end if;
  end if;

  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' and new.generated_by is distinct from (select auth.uid()) then
      raise exception 'Certificate generation must identify the authenticated generator';
    end if;
    if new.status = 'revoked' and new.revoked_by is distinct from (select auth.uid()) then
      raise exception 'Certificate revocation must identify the authenticated actor';
    end if;
  end if;

  select * into v_registration from public.registrations where id = new.registration_id;
  if not found then raise exception 'Certificate registration does not exist'; end if;
  select * into v_event from public.events where id = new.event_id;
  if not found then raise exception 'Certificate event does not exist'; end if;
  select * into v_category from public.race_categories where id = new.race_category_id;
  if not found then raise exception 'Certificate category does not exist'; end if;
  if v_registration.event_id <> new.event_id or v_registration.category_id <> new.race_category_id
    or v_category.event_id <> new.event_id or v_event.organization_id <> new.organization_id then
    raise exception 'Certificate relationships are inconsistent';
  end if;

  if new.result_id is not null then
    select * into v_result from public.results where id = new.result_id;
    if not found or v_result.validation_status <> 'valid'
      or v_result.result_status <> 'finished'
      or v_result.registration_id <> new.registration_id
      or v_result.event_id <> new.event_id
      or v_result.organization_id <> new.organization_id
      or v_result.race_category_id <> new.race_category_id then
      raise exception 'Certificate result is missing, invalid, or inconsistent';
    end if;
    select * into v_batch from public.result_batches where id = v_result.result_batch_id;
    if v_batch.publication_status <> 'published' then
      raise exception 'Certificates require a published result batch';
    end if;
    if v_result.bib_id is distinct from new.bib_id
      or new.participant_id is distinct from v_result.participant_id
      or new.participant_name_snapshot <> v_result.participant_display_name
      or new.finish_time_snapshot is distinct from v_result.gun_time
      or new.rank_snapshot is distinct from v_result.overall_rank
      or new.bib_code_snapshot is distinct from v_result.bib_code then
      raise exception 'Certificate snapshots do not match the eligible result';
    end if;
  else
    if v_registration.status <> 'confirmed' then
      raise exception 'Participation certificates require a confirmed registration';
    end if;
    if new.bib_id is not null or new.finish_time_snapshot is not null or new.rank_snapshot is not null or new.bib_code_snapshot is not null then
      raise exception 'Participation certificates cannot contain race result details';
    end if;
    if new.participant_id is distinct from v_registration.user_id
      or new.participant_name_snapshot <> nullif(btrim(concat_ws(' ', v_registration.first_name, nullif(btrim(v_registration.middle_name), ''), v_registration.last_name)), '') then
      raise exception 'Participation certificate snapshots do not match the registration';
    end if;
  end if;

  if new.event_name_snapshot <> v_event.name or new.category_name_snapshot <> v_category.name
    or new.event_date_snapshot <> v_event.event_date then
    raise exception 'Certificate event snapshots do not match the event';
  end if;

  select * into v_settings from public.event_certificate_settings
  where event_id = new.event_id and enabled = true;
  if not found then raise exception 'Certificates are disabled for this event'; end if;
  if new.result_id is null and v_settings.eligibility_mode <> 'organizer_defined' then
    raise exception 'All-participant certificates are not enabled for this event';
  end if;
  if v_settings.eligibility_mode = 'finished_selected_categories'
    and not exists (
      select 1 from public.event_certificate_categories ecc
      where ecc.settings_id = v_settings.id and ecc.race_category_id = new.race_category_id
    ) then
    raise exception 'Certificate category is not eligible';
  end if;

  select * into v_template from public.certificate_templates where id = new.template_id;
  if not found or (v_template.organization_id is not null and v_template.organization_id <> new.organization_id) then
    raise exception 'Certificate template is unavailable';
  end if;
  if tg_op = 'INSERT' and new.template_version <> v_template.version then
    raise exception 'Certificate template version does not match the selected template';
  end if;
  return new;
end;
$$;
