-- RaceDeck E-Certificates module
-- Rendering, storage, QR generation, notifications, and scheduling remain in
-- trusted backend/worker services. Database rows provide eligibility,
-- historical integrity, verification, tenant isolation, and idempotency.

create type certificate_template_status as enum ('active', 'inactive');
create type certificate_eligibility_mode as enum (
  'finished_all', 'finished_selected_categories', 'organizer_defined'
);
create type certificate_status as enum ('generated', 'issued', 'revoked');

create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  name text not null,
  is_system_template boolean not null default false,
  certificate_title text not null,
  layout_config jsonb not null default '{}'::jsonb,
  background_asset_reference text,
  event_logo_reference text,
  organizer_logo_reference text,
  sponsor_logo_config jsonb not null default '[]'::jsonb,
  signature_image_reference text,
  signatory_name text,
  signatory_position text,
  certificate_message text,
  version integer not null default 1,
  status certificate_template_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_templates_name_not_blank check (btrim(name) <> ''),
  constraint certificate_templates_title_not_blank check (btrim(certificate_title) <> ''),
  constraint certificate_templates_version_positive check (version > 0),
  constraint certificate_templates_owner_type check (
    (is_system_template and organization_id is null)
    or (not is_system_template and organization_id is not null)
  ),
  constraint certificate_templates_system_creator check (
    is_system_template or created_by is not null
  )
);

create table public.event_certificate_settings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  enabled boolean not null default false,
  template_id uuid references public.certificate_templates(id) on delete restrict,
  certificate_title text,
  event_logo_reference text,
  organizer_logo_reference text,
  sponsor_logo_config jsonb not null default '[]'::jsonb,
  signature_image_reference text,
  signatory_name text,
  signatory_position text,
  certificate_message text,
  eligibility_mode certificate_eligibility_mode not null default 'finished_all',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_certificate_settings_title_not_blank check (
    certificate_title is null or btrim(certificate_title) <> ''
  )
);

create table public.event_certificate_categories (
  settings_id uuid not null references public.event_certificate_settings(id) on delete cascade,
  race_category_id uuid not null references public.race_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (settings_id, race_category_id)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_reference text not null unique,
  -- Two independent UUIDs provide a 256-bit hexadecimal bearer token using
  -- the cryptographic UUID generator already enabled by the base schema.
  verification_token text not null unique default replace(
    gen_random_uuid()::text || gen_random_uuid()::text, '-', ''
  ),
  verification_path text,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  participant_id uuid references auth.users(id) on delete set null,
  race_category_id uuid not null references public.race_categories(id) on delete restrict,
  result_id uuid not null references public.results(id) on delete restrict,
  bib_id uuid references public.bibs(id) on delete restrict,
  participant_name_snapshot text not null,
  event_name_snapshot text not null,
  category_name_snapshot text not null,
  event_date_snapshot date not null,
  finish_time_snapshot interval,
  rank_snapshot integer,
  bib_code_snapshot text,
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  template_version integer not null,
  template_snapshot jsonb not null,
  document_storage_reference text,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  generation_metadata jsonb not null default '{}'::jsonb,
  status certificate_status not null default 'generated',
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificates_reference_not_blank check (btrim(certificate_reference) <> ''),
  constraint certificates_token_shape check (verification_token ~ '^[0-9a-f]{64}$'),
  constraint certificates_participant_name_not_blank check (btrim(participant_name_snapshot) <> ''),
  constraint certificates_event_name_not_blank check (btrim(event_name_snapshot) <> ''),
  constraint certificates_category_name_not_blank check (btrim(category_name_snapshot) <> ''),
  constraint certificates_template_version_positive check (template_version > 0),
  constraint certificates_template_snapshot_object check (jsonb_typeof(template_snapshot) = 'object'),
  constraint certificates_verification_path_not_blank check (
    verification_path is null or btrim(verification_path) <> ''
  ),
  constraint certificates_finish_time_nonnegative check (
    finish_time_snapshot is null or extract(epoch from finish_time_snapshot) >= 0
  ),
  constraint certificates_rank_positive check (rank_snapshot is null or rank_snapshot > 0),
  constraint certificates_status_metadata check (
    (status <> 'revoked' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (status = 'revoked' and revoked_at is not null and revocation_reason is not null
      and btrim(revocation_reason) <> '')
  ),
  constraint certificates_issued_requires_document check (
    status <> 'issued' or document_storage_reference is not null
  )
);

create unique index certificate_templates_org_name_version_uidx
  on public.certificate_templates (organization_id, lower(name), version)
  where organization_id is not null;
create unique index certificate_templates_system_name_version_uidx
  on public.certificate_templates (lower(name), version)
  where is_system_template;
create index certificate_templates_org_status_idx
  on public.certificate_templates (organization_id, status);
create index event_certificate_settings_org_idx
  on public.event_certificate_settings (organization_id);
create index event_certificate_settings_template_idx
  on public.event_certificate_settings (template_id);
create index event_certificate_categories_category_idx
  on public.event_certificate_categories (race_category_id);
create index certificates_org_event_idx on public.certificates (organization_id, event_id);
create index certificates_registration_idx on public.certificates (registration_id);
create index certificates_participant_idx on public.certificates (participant_id);
create index certificates_category_idx on public.certificates (race_category_id);
create index certificates_result_idx on public.certificates (result_id);
create index certificates_bib_idx on public.certificates (bib_id);
create index certificates_status_generated_idx
  on public.certificates (status, generated_at desc);
create unique index certificates_active_result_uidx
  on public.certificates (result_id)
  where status in ('generated', 'issued');
create unique index certificates_active_registration_uidx
  on public.certificates (event_id, registration_id)
  where status in ('generated', 'issued');

create or replace function private.validate_certificate_template()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if not new.is_system_template and new.organization_id is null then
    raise exception 'Organizer templates require an organization';
  end if;
  if new.is_system_template and new.organization_id is not null then
    raise exception 'System templates cannot belong to an organization';
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Template ownership is immutable';
  end if;
  if tg_op = 'UPDATE' and new.version < old.version then
    raise exception 'Template version cannot decrease';
  end if;
  return new;
end;
$$;

create or replace function private.validate_event_certificate_scope()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_template public.certificate_templates%rowtype;
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'Certificate settings event does not belong to organization';
  end if;
  if new.template_id is not null then
    select * into v_template from public.certificate_templates where id = new.template_id;
    if not found or v_template.status <> 'active'
      or (v_template.organization_id is not null and v_template.organization_id <> new.organization_id) then
      raise exception 'Certificate template is unavailable to this organization';
    end if;
  end if;
  if new.enabled and new.template_id is null then
    raise exception 'Enabled certificate settings require a template';
  end if;
  return new;
end;
$$;

create or replace function private.validate_event_certificate_category()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if not exists (
    select 1
    from public.event_certificate_settings s
    join public.race_categories c on c.event_id = (
      select event_id from public.event_certificate_settings where id = new.settings_id
    )
    where s.id = new.settings_id and c.id = new.race_category_id
  ) then
    raise exception 'Certificate category does not belong to the configured event';
  end if;
  return new;
end;
$$;

create or replace function private.ensure_certificate_category_selection()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_settings_id uuid := case when tg_op = 'DELETE' then old.settings_id else new.settings_id end;
begin
  if exists (
    select 1 from public.event_certificate_settings s
    where s.id = v_settings_id
      and s.enabled = true
      and s.eligibility_mode = 'finished_selected_categories'
  ) and not exists (
    select 1 from public.event_certificate_categories c
    where c.settings_id = v_settings_id
  ) then
    raise exception 'Selected-category eligibility requires at least one category';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
      or new.result_id <> old.result_id
      or new.template_id <> old.template_id
      or new.template_version <> old.template_version
      or new.template_snapshot <> old.template_snapshot
      or new.participant_name_snapshot <> old.participant_name_snapshot
      or new.event_name_snapshot <> old.event_name_snapshot
      or new.category_name_snapshot <> old.category_name_snapshot
      or new.event_date_snapshot <> old.event_date_snapshot
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
  select * into v_registration from public.registrations where id = new.registration_id;
  select * into v_event from public.events where id = new.event_id;
  select * into v_category from public.race_categories where id = new.race_category_id;
  if v_registration.event_id <> new.event_id or v_registration.category_id <> new.race_category_id
    or v_category.event_id <> new.event_id or v_event.organization_id <> new.organization_id then
    raise exception 'Certificate relationships are inconsistent';
  end if;
  if v_result.bib_id is distinct from new.bib_id then
    raise exception 'Certificate bib does not match result';
  end if;
  if new.participant_id is distinct from v_result.participant_id
    or new.participant_name_snapshot <> v_result.participant_display_name
    or new.event_name_snapshot <> v_event.name
    or new.category_name_snapshot <> v_category.name
    or new.event_date_snapshot <> v_event.event_date
    or new.finish_time_snapshot is distinct from v_result.gun_time
    or new.rank_snapshot is distinct from v_result.overall_rank
    or new.bib_code_snapshot is distinct from v_result.bib_code then
    raise exception 'Certificate snapshots do not match the eligible result';
  end if;

  select * into v_settings from public.event_certificate_settings
  where event_id = new.event_id and enabled = true;
  if not found then raise exception 'Certificates are disabled for this event'; end if;
  if v_settings.eligibility_mode = 'finished_selected_categories'
    and not exists (
      select 1 from public.event_certificate_categories ecc
      where ecc.settings_id = v_settings.id and ecc.race_category_id = new.race_category_id
    ) then
    raise exception 'Result category is not eligible for certificates';
  end if;
  -- organizer_defined remains intentionally limited to finished results in MVP;
  -- the settings mode allows a future explicit eligibility workflow without
  -- accidentally issuing certificates to DNF/DNS/DQ rows.

  select * into v_template from public.certificate_templates where id = new.template_id;
  if not found
    or (v_template.organization_id is not null and v_template.organization_id <> new.organization_id) then
    raise exception 'Certificate template is unavailable';
  end if;
  if tg_op = 'INSERT' and new.template_version <> v_template.version then
    raise exception 'Certificate template version does not match the selected template';
  end if;
  if new.participant_name_snapshot is null or new.event_name_snapshot is null
    or new.category_name_snapshot is null then
    raise exception 'Certificate snapshots are required';
  end if;
  return new;
end;
$$;

create or replace function public.verify_certificate(p_verification_token text)
returns table (
  certificate_reference text,
  participant_name text,
  event_name text,
  category_name text,
  event_date date,
  finish_time interval,
  rank integer,
  status certificate_status
)
language sql
security definer
stable
set search_path = public
as $$
  select c.certificate_reference, c.participant_name_snapshot,
    c.event_name_snapshot, c.category_name_snapshot, c.event_date_snapshot,
    c.finish_time_snapshot, c.rank_snapshot, c.status
  from public.certificates c
  where c.verification_token = p_verification_token
    and c.status = 'issued'
    and c.revoked_at is null;
$$;

create trigger certificate_templates_validate_trigger
  before insert or update on public.certificate_templates
  for each row execute function private.validate_certificate_template();
create trigger event_certificate_settings_validate_trigger
  before insert or update on public.event_certificate_settings
  for each row execute function private.validate_event_certificate_scope();
create trigger event_certificate_categories_validate_trigger
  before insert or update on public.event_certificate_categories
  for each row execute function private.validate_event_certificate_category();
create constraint trigger event_certificate_settings_categories_complete_trigger
  after insert or update on public.event_certificate_settings
  deferrable initially deferred
  for each row execute function private.ensure_certificate_category_selection();
create constraint trigger event_certificate_categories_complete_trigger
  after insert or update or delete on public.event_certificate_categories
  deferrable initially deferred
  for each row execute function private.ensure_certificate_category_selection();
create trigger certificates_validate_trigger
  before insert or update on public.certificates
  for each row execute function private.validate_certificate_eligibility();

create trigger certificate_templates_updated_at_trigger
  before update on public.certificate_templates
  for each row execute function public.set_payment_updated_at();
create trigger event_certificate_settings_updated_at_trigger
  before update on public.event_certificate_settings
  for each row execute function public.set_payment_updated_at();
create trigger certificates_updated_at_trigger
  before update on public.certificates
  for each row execute function public.set_payment_updated_at();

alter table public.certificate_templates enable row level security;
alter table public.event_certificate_settings enable row level security;
alter table public.event_certificate_categories enable row level security;
alter table public.certificates enable row level security;

create policy "Authenticated users can view active system certificate templates"
  on public.certificate_templates for select to authenticated
  using (is_system_template and status = 'active');
create policy "Certificate managers can view organization templates"
  on public.certificate_templates for select to authenticated
  using (
    organization_id is not null and exists (
      select 1 from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where om.organization_id = certificate_templates.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key = 'manage_certificates'
    )
  );
create policy "Certificate managers can create organization templates"
  on public.certificate_templates for insert to authenticated
  with check (
    not is_system_template and created_by = (select auth.uid())
    and exists (select 1 from public.organization_members om
      join public.role_permissions rp on rp.role = om.role
      join public.permissions p on p.id = rp.permission_id
      where om.organization_id = certificate_templates.organization_id
        and om.user_id = (select auth.uid()) and om.is_active = true
        and p.key = 'manage_certificates')
  );
create policy "Certificate managers can update organization templates"
  on public.certificate_templates for update to authenticated
  using (organization_id is not null and exists (select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where om.organization_id = certificate_templates.organization_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'))
  with check (not is_system_template and organization_id is not null);

create policy "Certificate managers can view event settings"
  on public.event_certificate_settings for select to authenticated
  using (exists (select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_certificate_settings.organization_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'));
create policy "Certificate managers can manage event settings"
  on public.event_certificate_settings for all to authenticated
  using (exists (select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_certificate_settings.organization_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'))
  with check (exists (select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_certificate_settings.organization_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'));

create policy "Certificate managers can view event categories"
  on public.event_certificate_categories for select to authenticated
  using (exists (select 1 from public.event_certificate_settings s
    join public.organization_members om on om.organization_id = s.organization_id
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where s.id = event_certificate_categories.settings_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'));
create policy "Certificate managers can manage event categories"
  on public.event_certificate_categories for all to authenticated
  using (exists (select 1 from public.event_certificate_settings s
    join public.organization_members om on om.organization_id = s.organization_id
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where s.id = event_certificate_categories.settings_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'))
  with check (exists (select 1 from public.event_certificate_settings s
    join public.organization_members om on om.organization_id = s.organization_id
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where s.id = event_certificate_categories.settings_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'));

create policy "Participants can view their issued certificates"
  on public.certificates for select to authenticated
  using (status = 'issued' and revoked_at is null
    and participant_id = (select auth.uid()));
create policy "Certificate managers can view organization certificates"
  on public.certificates for select to authenticated
  using (exists (select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role join public.permissions p on p.id = rp.permission_id
    where om.organization_id = certificates.organization_id and om.user_id = (select auth.uid())
      and om.is_active = true and p.key = 'manage_certificates'));
revoke all on public.certificate_templates from public, anon;
revoke all on public.event_certificate_settings from public, anon;
revoke all on public.event_certificate_categories from public, anon;
revoke all on public.certificates from public, anon;
grant select, insert, update on public.certificate_templates to authenticated;
grant select, insert, update, delete on public.event_certificate_settings to authenticated;
grant select, insert, update, delete on public.event_certificate_categories to authenticated;
grant select on public.certificates to authenticated;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;
