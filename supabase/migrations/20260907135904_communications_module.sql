-- ============================================================
-- RaceDeck PH — Migration 008: Communications & Transactional Email
--
-- This migration provides persistence, tenant isolation, auditability, and
-- idempotency for in-app notifications and provider-agnostic email delivery.
-- Sending, scheduling, rendering, and provider credentials remain outside SQL.
-- ============================================================

create type communication_channel as enum ('in_app', 'email');
create type announcement_audience as enum ('all_confirmed', 'category_confirmed');
create type announcement_status as enum ('draft', 'published', 'sent', 'failed', 'cancelled');
create type notification_type as enum (
  'registration_created', 'payment_pending', 'payment_confirmed', 'payment_failed',
  'registration_confirmed', 'receipt_available', 'invoice_available',
  'refund_completed', 'race_kit_available', 'race_kit_claiming_deadline',
  'race_kit_claimed', 'event_reminder', 'race_tomorrow', 'organizer_announcement',
  'results_published', 'e_certificate_ready', 'organizer_verification_result',
  'event_review_result', 'new_registration', 'payment_notification',
  'refund_notification', 'payout_notification', 'important_email_delivery_failure'
);
create type notification_delivery_status as enum (
  'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'suppressed'
);
create type email_type as enum (
  'organizer_verification', 'event_approval', 'event_needs_changes', 'event_rejection',
  'registration_pending_payment', 'payment_successful', 'payment_failed',
  'registration_confirmed', 'payment_receipt', 'invoice', 'refund_processed',
  'race_reminder', 'race_kit_available', 'race_kit_claiming_deadline',
  'race_kit_claimed', 'organizer_announcement', 'results_published',
  'e_certificate_available'
);
create type email_status as enum ('queued', 'sending', 'delivered', 'failed', 'bounced', 'suppressed');
create type template_status as enum ('active', 'inactive');
create type reminder_type as enum ('race_reminder', 'race_tomorrow', 'race_kit_claiming_deadline', 'custom');
create type email_delivery_event_type as enum ('delivered', 'failed', 'bounced', 'suppressed');

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  message text not null,
  audience announcement_audience not null,
  race_category_id uuid references public.race_categories(id) on delete restrict,
  delivery_channels communication_channel[] not null default '{in_app}'::communication_channel[],
  status announcement_status not null default 'draft',
  published_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_title_not_blank check (btrim(title) <> ''),
  constraint announcements_message_not_blank check (btrim(message) <> ''),
  constraint announcements_audience_category check (
    (audience = 'all_confirmed' and race_category_id is null)
    or (audience = 'category_confirmed' and race_category_id is not null)
  ),
  constraint announcements_channels_nonempty check (cardinality(delivery_channels) > 0),
  constraint announcements_channels_no_nulls check (array_position(delivery_channels, null) is null),
  constraint announcements_channels_mvp_only check (
    delivery_channels <@ enum_range(null::communication_channel)
  ),
  constraint announcements_publication_timestamps check (
    (status = 'draft' and published_at is null and sent_at is null)
    or (status = 'published' and published_at is not null)
    or (status = 'sent' and published_at is not null and sent_at is not null)
    or (status = 'failed' and published_at is not null)
    or (status = 'cancelled')
  )
);

create index announcements_organization_idx on public.announcements (organization_id);
create index announcements_event_status_idx on public.announcements (event_id, status, published_at desc);
create index announcements_category_idx on public.announcements (race_category_id);
create index announcements_created_by_idx on public.announcements (created_by);

-- ============================================================
-- EVENT REMINDER SETTINGS
-- ============================================================
create table public.event_reminder_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  reminder_key text not null,
  reminder_type reminder_type not null,
  lead_time_minutes integer not null,
  enabled boolean not null default true,
  instructions text,
  custom_schedule_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminder_key_not_blank check (btrim(reminder_key) <> ''),
  constraint reminder_lead_time_positive check (lead_time_minutes > 0),
  constraint reminder_instructions_not_blank check (
    instructions is null or btrim(instructions) <> ''
  ),
  constraint reminder_custom_schedule_valid check (
    (reminder_type = 'custom' and custom_schedule_at is not null)
    or (reminder_type <> 'custom' and custom_schedule_at is null)
  ),
  unique (event_id, reminder_key)
);

create index reminder_settings_organization_idx on public.event_reminder_settings (organization_id);
create index reminder_settings_event_enabled_idx
  on public.event_reminder_settings (event_id, enabled, lead_time_minutes);

-- ============================================================
-- LOGICAL NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  source_announcement_id uuid references public.announcements(id) on delete set null,
  reminder_setting_id uuid references public.event_reminder_settings(id) on delete set null,
  notification_type notification_type not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_body_not_blank check (btrim(body) <> ''),
  constraint notifications_idempotency_not_blank check (
    idempotency_key is null or btrim(idempotency_key) <> ''
  )
);

create unique index notifications_idempotency_uidx
  on public.notifications (idempotency_key)
  where idempotency_key is not null;
create unique index notifications_announcement_recipient_uidx
  on public.notifications (source_announcement_id, recipient_user_id)
  where source_announcement_id is not null;
create unique index notifications_reminder_registration_uidx
  on public.notifications (reminder_setting_id, registration_id)
  where reminder_setting_id is not null and registration_id is not null;
create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_organization_idx on public.notifications (organization_id);
create index notifications_event_idx on public.notifications (event_id);
create index notifications_registration_idx on public.notifications (registration_id);
create index notifications_type_created_idx on public.notifications (notification_type, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

-- ============================================================
-- NOTIFICATION DELIVERIES
-- ============================================================
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  channel communication_channel not null,
  status notification_delivery_status not null default 'queued',
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  provider_reference text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_deliveries_retry_nonnegative check (retry_count >= 0),
  constraint notification_deliveries_idempotency_not_blank check (
    idempotency_key is null or btrim(idempotency_key) <> ''
  ),
  unique (notification_id, channel)
);

create unique index notification_deliveries_idempotency_uidx
  on public.notification_deliveries (idempotency_key)
  where idempotency_key is not null;
create unique index notification_deliveries_provider_reference_uidx
  on public.notification_deliveries (provider_reference)
  where provider_reference is not null;
create index notification_deliveries_recipient_idx
  on public.notification_deliveries (recipient_user_id, created_at desc);
create index notification_deliveries_status_queued_idx
  on public.notification_deliveries (status, queued_at)
  where status in ('queued', 'sending', 'failed');
create index notification_deliveries_notification_idx on public.notification_deliveries (notification_id);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_type email_type not null,
  name text not null,
  subject_template text not null,
  content_template jsonb not null,
  version_number integer not null,
  status template_status not null default 'active',
  system_managed boolean not null default true,
  organization_id uuid references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_templates_name_not_blank check (btrim(name) <> ''),
  constraint email_templates_subject_not_blank check (btrim(subject_template) <> ''),
  constraint email_templates_content_object check (
    jsonb_typeof(content_template) in ('object', 'string')
  ),
  constraint email_templates_version_positive check (version_number > 0),
  constraint email_templates_system_scope check (
    (system_managed and organization_id is null and event_id is null)
    or (not system_managed and organization_id is not null and event_id is not null)
  )
);

create unique index email_templates_global_version_uidx
  on public.email_templates (template_type, version_number)
  where system_managed and organization_id is null and event_id is null;
create unique index email_templates_event_version_uidx
  on public.email_templates (template_type, organization_id, event_id, version_number)
  where not system_managed and organization_id is not null and event_id is not null;
create index email_templates_type_status_idx on public.email_templates (template_type, status);
create index email_templates_organization_event_idx
  on public.email_templates (organization_id, event_id, template_type, status);

-- ============================================================
-- EMAIL MESSAGES — historical logical messages
-- ============================================================
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  receipt_id uuid references public.payment_receipts(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  announcement_id uuid references public.announcements(id) on delete set null,
  reminder_setting_id uuid references public.event_reminder_settings(id) on delete set null,
  email_type email_type not null,
  template_id uuid references public.email_templates(id) on delete set null,
  template_version integer not null,
  template_snapshot jsonb not null,
  subject text not null,
  rendered_body_reference text,
  provider_message_id text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  status email_status not null default 'queued',
  failure_reason text,
  retry_count integer not null default 0,
  idempotency_key text not null,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_messages_recipient_email_not_blank check (btrim(recipient_email) <> ''),
  constraint email_messages_template_version_positive check (template_version > 0),
  constraint email_messages_template_snapshot_object check (jsonb_typeof(template_snapshot) in ('object', 'string')),
  constraint email_messages_subject_not_blank check (btrim(subject) <> ''),
  constraint email_messages_retry_nonnegative check (retry_count >= 0),
  constraint email_messages_idempotency_not_blank check (btrim(idempotency_key) <> ''),
  constraint email_messages_idempotency_unique_scope check (idempotency_key <> ''),
  constraint email_messages_delivery_timestamps check (
    (status = 'queued' and sent_at is null and delivered_at is null)
    or (status in ('sending', 'failed', 'bounced', 'suppressed') and delivered_at is null)
    or (status = 'delivered' and sent_at is not null and delivered_at is not null)
  )
);

create unique index email_messages_idempotency_uidx on public.email_messages (idempotency_key);
create unique index email_messages_provider_message_uidx
  on public.email_messages (provider_message_id)
  where provider_message_id is not null;
create index email_messages_recipient_email_idx on public.email_messages (recipient_email);
create index email_messages_recipient_user_idx on public.email_messages (recipient_user_id);
create index email_messages_organization_idx on public.email_messages (organization_id);
create index email_messages_event_idx on public.email_messages (event_id);
create index email_messages_registration_idx on public.email_messages (registration_id);
create index email_messages_type_status_idx on public.email_messages (email_type, status);
create index email_messages_status_queued_idx on public.email_messages (status, queued_at)
  where status in ('queued', 'sending', 'failed');
create index email_messages_sent_idx on public.email_messages (sent_at desc);
create index email_messages_template_idx on public.email_messages (template_id, template_version);
create unique index email_messages_reminder_registration_uidx
  on public.email_messages (reminder_setting_id, registration_id)
  where reminder_setting_id is not null and registration_id is not null;

-- ============================================================
-- EMAIL DELIVERY LOGS — provider events, separate from message content
-- ============================================================
create table public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  email_message_id uuid not null references public.email_messages(id) on delete cascade,
  provider_event_id text not null,
  provider_message_id text,
  event_type email_delivery_event_type not null,
  provider_response jsonb not null default '{}'::jsonb,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint email_delivery_logs_event_id_not_blank check (btrim(provider_event_id) <> '')
);

create unique index email_delivery_logs_provider_event_uidx
  on public.email_delivery_logs (provider_event_id);
create index email_delivery_logs_message_idx on public.email_delivery_logs (email_message_id, occurred_at desc);
create index email_delivery_logs_provider_message_idx on public.email_delivery_logs (provider_message_id);
create index email_delivery_logs_event_type_idx on public.email_delivery_logs (event_type, occurred_at desc);

-- ============================================================
-- SCOPE / STATE GUARDS
-- ============================================================
create schema if not exists private;

create or replace function private.validate_announcement_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'announcement organization must own its event';
  end if;
  if new.race_category_id is not null and not exists (
    select 1 from public.race_categories rc
    where rc.id = new.race_category_id and rc.event_id = new.event_id
  ) then
    raise exception 'announcement category must belong to its event';
  end if;
  return new;
end;
$$;

create trigger announcements_scope_guard
  before insert or update on public.announcements
  for each row execute function private.validate_announcement_scope();

create or replace function private.validate_reminder_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'reminder organization must own its event';
  end if;
  return new;
end;
$$;

create trigger reminder_settings_scope_guard
  before insert or update on public.event_reminder_settings
  for each row execute function private.validate_reminder_scope();

create or replace function private.validate_template_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.event_id is not null and not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.organization_id = new.organization_id
  ) then
    raise exception 'template organization must own its event';
  end if;
  return new;
end;
$$;

create trigger email_templates_scope_guard
  before insert or update on public.email_templates
  for each row execute function private.validate_template_scope();

create or replace function private.validate_reminder_target()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.notification_type in ('event_reminder', 'race_tomorrow')
     and (new.registration_id is null or not exists (
       select 1 from public.registrations r
       where r.id = new.registration_id and r.status = 'confirmed'
     )) then
    raise exception 'automatic reminder notifications require a confirmed registration';
  end if;
  return new;
end;
$$;

create trigger notifications_confirmed_reminder_guard
  before insert or update on public.notifications
  for each row execute function private.validate_reminder_target();

create or replace function private.validate_email_reminder_target()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.email_type = 'race_reminder'
     and (new.registration_id is null or not exists (
       select 1 from public.registrations r
       where r.id = new.registration_id and r.status = 'confirmed'
     )) then
    raise exception 'automatic reminder emails require a confirmed registration';
  end if;
  return new;
end;
$$;

create trigger email_messages_confirmed_reminder_guard
  before insert or update on public.email_messages
  for each row execute function private.validate_email_reminder_target();

-- Reuse the payment module's existing timestamp function for every new
-- mutable communication record.
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_payment_updated_at();
create trigger reminder_settings_set_updated_at
  before update on public.event_reminder_settings
  for each row execute function public.set_payment_updated_at();
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_payment_updated_at();
create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_payment_updated_at();
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_payment_updated_at();
create trigger email_messages_set_updated_at
  before update on public.email_messages
  for each row execute function public.set_payment_updated_at();

-- ============================================================
-- RLS / LEAST-PRIVILEGE ACCESS
-- ============================================================
alter table public.announcements enable row level security;
alter table public.event_reminder_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_delivery_logs enable row level security;

revoke all on public.announcements, public.event_reminder_settings, public.notifications,
  public.notification_deliveries, public.email_templates, public.email_messages,
  public.email_delivery_logs from anon, authenticated;

grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.event_reminder_settings to authenticated;
grant select on public.notifications, public.notification_deliveries,
  public.email_templates, public.email_messages, public.email_delivery_logs to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.announcements, public.event_reminder_settings, public.notifications,
  public.notification_deliveries, public.email_templates, public.email_messages,
  public.email_delivery_logs to service_role;

-- Organizers may manage only announcements for their own events and only
-- with the existing manage_announcements permission.
create policy "Announcement managers can view announcements"
  on public.announcements for select to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = announcements.event_id and e.organization_id = announcements.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_announcements'
  ));

create policy "Announcement managers can create announcements"
  on public.announcements for insert to authenticated
  with check (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = announcements.event_id and e.organization_id = announcements.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_announcements'
  ));

create policy "Announcement managers can update announcements"
  on public.announcements for update to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = announcements.event_id and e.organization_id = announcements.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_announcements'
  ))
  with check (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = announcements.event_id and e.organization_id = announcements.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_announcements'
  ));

create policy "Announcement managers can delete announcements"
  on public.announcements for delete to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = announcements.event_id and e.organization_id = announcements.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_announcements'
  ));

create policy "Reminder managers can view event settings"
  on public.event_reminder_settings for select to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = event_reminder_settings.event_id
      and e.organization_id = event_reminder_settings.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_email_reminders'
  ));

create policy "Reminder managers can manage event settings"
  on public.event_reminder_settings for all to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = event_reminder_settings.event_id
      and e.organization_id = event_reminder_settings.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_email_reminders'
  ))
  with check (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = event_reminder_settings.event_id
      and e.organization_id = event_reminder_settings.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key = 'manage_email_reminders'
  ));

-- A notification is private to its recipient. Event/organization context is
-- not sufficient to let one participant see another participant's message.
create policy "Users can view their own notifications"
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

create policy "Users can view their own notification deliveries"
  on public.notification_deliveries for select to authenticated
  using (recipient_user_id = (select auth.uid()));

create policy "Event communication managers can view notification deliveries"
  on public.notification_deliveries for select to authenticated
  using (exists (
    select 1
    from public.notifications n
    join public.events e on e.id = n.event_id
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where n.id = notification_deliveries.notification_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key in ('manage_announcements', 'manage_email_reminders')
  ));

-- System templates are readable reference data; event customizations are
-- readable only by their owning organization's reminder/announcement managers.
create policy "Authenticated users can view active system templates"
  on public.email_templates for select to authenticated
  using (system_managed = true and status = 'active');

create policy "Template managers can view event templates"
  on public.email_templates for select to authenticated
  using (exists (
    select 1 from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = email_templates.event_id and e.organization_id = email_templates.organization_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key in ('manage_announcements', 'manage_email_reminders')
  ));

-- Email history is visible to the recipient when tied to their registration;
-- authorized event communication managers may inspect event-scoped history.
create policy "Users can view their own email messages"
  on public.email_messages for select to authenticated
  using (recipient_user_id = (select auth.uid()) or exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = (select auth.uid())
  ));

create policy "Communication managers can view event email messages"
  on public.email_messages for select to authenticated
  using (exists (
    select 1
    from public.events e
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where e.id = email_messages.event_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key in ('manage_announcements', 'manage_email_reminders')
  ));

create policy "Users can view their own email delivery logs"
  on public.email_delivery_logs for select to authenticated
  using (exists (
    select 1 from public.email_messages em
    where em.id = email_message_id
      and (em.recipient_user_id = (select auth.uid()) or exists (
        select 1 from public.registrations r
        where r.id = em.registration_id and r.user_id = (select auth.uid())
      ))
  ));

create policy "Communication managers can view event delivery logs"
  on public.email_delivery_logs for select to authenticated
  using (exists (
    select 1
    from public.email_messages em
    join public.events e on e.id = em.event_id
    join public.organization_members om on om.organization_id = e.organization_id
    join public.role_permissions rp on rp.role = om.role
    join public.permissions p on p.id = rp.permission_id
    where em.id = email_message_id
      and om.user_id = (select auth.uid()) and om.is_active = true
      and p.key in ('manage_announcements', 'manage_email_reminders')
  ));
