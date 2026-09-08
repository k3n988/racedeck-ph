-- RaceDeck Legal module
-- Platform legal documents and event waivers are intentionally separate
-- systems. Legal text is persisted as text or a private storage reference;
-- signed-document rendering and registration UI remain outside this migration.

create type legal_document_type as enum ('terms', 'privacy_policy', 'refund_policy');
create type legal_document_status as enum ('draft', 'published', 'retired');
create type event_waiver_status as enum ('draft', 'published', 'retired');

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type legal_document_type not null,
  title text not null,
  version integer not null,
  content text,
  content_storage_reference text,
  effective_at timestamptz not null,
  status legal_document_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_title_not_blank check (btrim(title) <> ''),
  constraint legal_documents_version_positive check (version > 0),
  constraint legal_documents_content_present check (
    (content is not null and btrim(content) <> '')
    or (content_storage_reference is not null and btrim(content_storage_reference) <> '')
  ),
  constraint legal_documents_publication_metadata check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('published', 'retired') and published_at is not null and published_by is not null)
  ),
  unique (document_type, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  legal_document_id uuid not null references public.legal_documents(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  device_context jsonb not null default '{}'::jsonb,
  source_context text,
  created_at timestamptz not null default now(),
  constraint legal_acceptances_source_not_blank check (
    source_context is null or btrim(source_context) <> ''
  ),
  unique (user_id, legal_document_id)
);

create table public.event_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  title text not null,
  version integer not null,
  content text,
  content_storage_reference text,
  effective_at timestamptz not null,
  status event_waiver_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_waivers_title_not_blank check (btrim(title) <> ''),
  constraint event_waivers_version_positive check (version > 0),
  constraint event_waivers_content_present check (
    (content is not null and btrim(content) <> '')
    or (content_storage_reference is not null and btrim(content_storage_reference) <> '')
  ),
  constraint event_waivers_publication_metadata check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('published', 'retired') and published_at is not null and published_by is not null)
  ),
  unique (event_id, version)
);

create table public.event_waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  event_waiver_id uuid not null references public.event_waivers(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  participant_id uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  device_context jsonb not null default '{}'::jsonb,
  source_context text,
  created_at timestamptz not null default now(),
  constraint event_waiver_acceptances_source_not_blank check (
    source_context is null or btrim(source_context) <> ''
  ),
  unique (registration_id, event_waiver_id)
);

create unique index legal_documents_current_type_uidx
  on public.legal_documents (document_type)
  where status = 'published';
create index legal_documents_type_status_idx
  on public.legal_documents (document_type, status, effective_at desc);
create index legal_acceptances_user_idx
  on public.legal_acceptances (user_id, accepted_at desc);
create index legal_acceptances_document_idx
  on public.legal_acceptances (legal_document_id, accepted_at desc);
create unique index event_waivers_current_event_uidx
  on public.event_waivers (event_id)
  where status = 'published';
create index event_waivers_organization_idx on public.event_waivers (organization_id);
create index event_waivers_event_status_idx
  on public.event_waivers (event_id, status, effective_at desc);
create index event_waivers_version_idx on public.event_waivers (event_id, version);
create index event_waiver_acceptances_waiver_idx
  on public.event_waiver_acceptances (event_waiver_id, accepted_at desc);
create index event_waiver_acceptances_organization_idx
  on public.event_waiver_acceptances (organization_id);
create index event_waiver_acceptances_event_idx
  on public.event_waiver_acceptances (event_id, accepted_at desc);
create index event_waiver_acceptances_registration_idx
  on public.event_waiver_acceptances (registration_id);
create index event_waiver_acceptances_participant_idx
  on public.event_waiver_acceptances (participant_id);

create or replace function private.validate_legal_document()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.document_type <> old.document_type or new.title <> old.title
      or new.version <> old.version or new.content is distinct from old.content
      or new.content_storage_reference is distinct from old.content_storage_reference
      or new.effective_at <> old.effective_at or new.created_by is distinct from old.created_by then
      raise exception 'Published legal document versions are immutable';
    end if;
  end if;
  if new.status <> 'draft' and new.published_at is null then
    raise exception 'Published legal documents require publication metadata';
  end if;
  return new;
end;
$$;

create or replace function private.validate_event_waiver()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'Event waiver event does not belong to organization';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.organization_id <> old.organization_id or new.event_id <> old.event_id
      or new.title <> old.title or new.version <> old.version
      or new.content is distinct from old.content
      or new.content_storage_reference is distinct from old.content_storage_reference
      or new.effective_at <> old.effective_at or new.created_by is distinct from old.created_by then
      raise exception 'Published event waiver versions are immutable';
    end if;
  end if;
  if new.status <> 'draft' and new.published_at is null then
    raise exception 'Published event waivers require publication metadata';
  end if;
  return new;
end;
$$;

create or replace function private.validate_event_waiver_acceptance()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_waiver public.event_waivers%rowtype;
  v_registration public.registrations%rowtype;
begin
  select * into v_waiver from public.event_waivers where id = new.event_waiver_id;
  if not found or v_waiver.status <> 'published'
    or v_waiver.event_id <> new.event_id
    or v_waiver.organization_id <> new.organization_id then
    raise exception 'Acceptance must reference the published waiver for its event';
  end if;
  select * into v_registration from public.registrations where id = new.registration_id;
  if not found or v_registration.event_id <> new.event_id
    or (new.participant_id is distinct from v_registration.user_id) then
    raise exception 'Waiver acceptance does not match registration participant/event';
  end if;
  return new;
end;
$$;

create trigger legal_documents_validate_trigger
  before insert or update on public.legal_documents
  for each row execute function private.validate_legal_document();
create trigger event_waivers_validate_trigger
  before insert or update on public.event_waivers
  for each row execute function private.validate_event_waiver();
create trigger event_waiver_acceptances_validate_trigger
  before insert or update on public.event_waiver_acceptances
  for each row execute function private.validate_event_waiver_acceptance();
create trigger legal_documents_updated_at_trigger
  before update on public.legal_documents
  for each row execute function public.set_payment_updated_at();
create trigger event_waivers_updated_at_trigger
  before update on public.event_waivers
  for each row execute function public.set_payment_updated_at();

create or replace function private.prevent_legal_acceptance_mutation()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  raise exception 'Legal acceptance records are immutable';
end;
$$;

create trigger legal_acceptances_prevent_update_trigger
  before update or delete on public.legal_acceptances
  for each row execute function private.prevent_legal_acceptance_mutation();
create trigger event_waiver_acceptances_prevent_update_trigger
  before update or delete on public.event_waiver_acceptances
  for each row execute function private.prevent_legal_acceptance_mutation();

create or replace function private.prevent_legal_document_delete()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  raise exception 'Legal document versions cannot be deleted';
end;
$$;

create trigger legal_documents_prevent_delete_trigger
  before delete on public.legal_documents
  for each row execute function private.prevent_legal_document_delete();
create trigger event_waivers_prevent_delete_trigger
  before delete on public.event_waivers
  for each row execute function private.prevent_legal_document_delete();

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.event_waivers enable row level security;
alter table public.event_waiver_acceptances enable row level security;

create policy "Anyone can view published platform legal documents"
  on public.legal_documents for select
  to anon, authenticated
  using (status = 'published');

create policy "Users can view their legal acceptances"
  on public.legal_acceptances for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can record their own legal acceptance"
  on public.legal_acceptances for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.legal_documents d
      where d.id = legal_acceptances.legal_document_id and d.status = 'published'
    )
  );

create policy "Anyone can view published event waivers"
  on public.event_waivers for select
  to anon, authenticated
  using (status = 'published');
create policy "Event managers can view organization waivers"
  on public.event_waivers for select
  to authenticated
  using (exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_waivers.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'edit_events'
  ));
create policy "Event managers can create event waivers"
  on public.event_waivers for insert
  to authenticated
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_waivers.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'edit_events'
  ));
create policy "Event managers can update event waivers"
  on public.event_waivers for update
  to authenticated
  using (exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_waivers.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'edit_events'
  ))
  with check (exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_waivers.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'edit_events'
  ));

create policy "Participants can view their waiver acceptances"
  on public.event_waiver_acceptances for select
  to authenticated
  using (participant_id = (select auth.uid()));
create policy "Participant managers can view organization waiver acceptances"
  on public.event_waiver_acceptances for select
  to authenticated
  using (exists (
    select 1 from public.organization_members om
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = event_waiver_acceptances.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'view_participants'
  ));
create policy "Participants can record their waiver acceptance"
  on public.event_waiver_acceptances for insert
  to authenticated
  with check (
    participant_id = (select auth.uid())
    and exists (
      select 1 from public.registrations r
      where r.id = event_waiver_acceptances.registration_id
        and r.user_id = (select auth.uid())
    )
  );

revoke all on public.legal_documents, public.legal_acceptances,
  public.event_waivers, public.event_waiver_acceptances
  from public, anon, authenticated;
grant select on public.legal_documents to anon, authenticated;
grant select, insert on public.legal_acceptances to authenticated;
grant select on public.event_waivers to anon, authenticated;
grant select, insert on public.event_waiver_acceptances to authenticated;
grant all on public.legal_documents, public.legal_acceptances,
  public.event_waivers, public.event_waiver_acceptances to service_role;
