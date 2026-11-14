import 'server-only';

import { decodeReminderContent, encodeReminderContent, reminderHtmlToPlainText } from '@/lib/email/reminder-content';
import { createAdminClient } from '@/lib/supabase/admin';

type ReminderSetting = {
  id: string;
  event_id: string;
  organization_id: string;
  reminder_key: string;
  reminder_type: 'race_reminder' | 'race_tomorrow' | 'race_kit_claiming_deadline' | 'custom';
  lead_time_minutes: number;
  custom_schedule_at: string | null;
  instructions: string | null;
  events: { id: string; name: string; event_date: string } | null;
};

type Registration = { id: string; user_id: string | null; email: string | null };
const SETTING_PAGE_SIZE = 100;
const REGISTRATION_PAGE_SIZE = 500;

function dueAt(setting: ReminderSetting): Date {
  if (setting.custom_schedule_at) return new Date(setting.custom_schedule_at);
  const raceDayStart = new Date(`${setting.events?.event_date ?? 'invalid'}T00:00:00+08:00`);
  return new Date(raceDayStart.getTime() - setting.lead_time_minutes * 60_000);
}

async function loadAllEnabledSettings(batchSize: number): Promise<ReminderSetting[]> {
  const admin = createAdminClient();
  const rows: ReminderSetting[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await admin.from('event_reminder_settings')
      .select('id,event_id,organization_id,reminder_key,reminder_type,lead_time_minutes,custom_schedule_at,instructions,events(id,name,event_date)')
      .eq('enabled', true)
      .eq('reminder_key', 'organizer_event_reminder')
      .order('id')
      .range(offset, offset + batchSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as ReminderSetting[];
    rows.push(...page);
    if (page.length < batchSize) return rows;
  }
}

async function loadAllConfirmedRegistrations(eventId: string): Promise<Registration[]> {
  const admin = createAdminClient();
  const rows: Registration[] = [];
  for (let offset = 0; ; offset += REGISTRATION_PAGE_SIZE) {
    const { data, error } = await admin.from('registrations')
      .select('id,user_id,email')
      .eq('event_id', eventId)
      .eq('status', 'confirmed')
      .order('id')
      .range(offset, offset + REGISTRATION_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Registration[];
    rows.push(...page);
    if (page.length < REGISTRATION_PAGE_SIZE) return rows;
  }
}

export async function dispatchDueReminders(pageSize = SETTING_PAGE_SIZE): Promise<{ settings: number; registrations: number; notifications: number; emails: number }> {
  const admin = createAdminClient();
  const settings = await loadAllEnabledSettings(Math.max(1, Math.min(pageSize, SETTING_PAGE_SIZE)));
  const now = new Date();
  let dueSettings = 0;
  let registrationCount = 0;
  let notificationCount = 0;
  let emailCount = 0;

  for (const setting of settings) {
    if (!setting.events) continue;
    const content = decodeReminderContent(setting.instructions, setting.events.name);
    if (content.dispatched_at) continue;
    const due = dueAt(setting);
    if (!Number.isFinite(due.getTime()) || due > now) continue;
    dueSettings += 1;

    const registrations = await loadAllConfirmedRegistrations(setting.event_id);
    registrationCount += registrations.length;
    const notificationType = setting.reminder_type === 'race_tomorrow'
      ? 'race_tomorrow'
      : setting.reminder_type === 'race_kit_claiming_deadline'
        ? 'race_kit_claiming_deadline'
        : 'event_reminder';
    const raceDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
      .format(new Date(`${setting.events.event_date}T00:00:00+08:00`));
    const announcementText = content.body_format === 'html' ? reminderHtmlToPlainText(content.body) : content.body;
    const body = `${announcementText}\n\nEvent: ${setting.events.name}\nDate: ${raceDate}\nReview your RaceDeck registration for details.`;

    for (const registration of registrations) {
      const idempotency = `reminder:${setting.id}:${registration.id}`;
      if (registration.user_id) {
        const { data: createdNotification, error: notificationError } = await admin.from('notifications').upsert({
          recipient_user_id: registration.user_id,
          organization_id: setting.organization_id,
          event_id: setting.event_id,
          registration_id: registration.id,
          reminder_setting_id: setting.id,
          notification_type: notificationType,
          title: content.subject,
          body,
          metadata: { reminder_key: setting.reminder_key },
          idempotency_key: idempotency,
        }, { onConflict: 'reminder_setting_id,registration_id', ignoreDuplicates: true }).select('id,recipient_user_id').maybeSingle();
        if (notificationError) throw notificationError;
        if (createdNotification) notificationCount += 1;
        const notification = createdNotification ?? (await admin.from('notifications')
          .select('id,recipient_user_id')
          .eq('reminder_setting_id', setting.id)
          .eq('registration_id', registration.id)
          .maybeSingle()).data;
        if (!notification) throw new Error('Reminder notification could not be loaded after saving.');
        const { error: deliveryError } = await admin.from('notification_deliveries').upsert({
          notification_id: notification.id,
          recipient_user_id: notification.recipient_user_id,
          channel: 'in_app',
          status: 'queued',
          idempotency_key: `${idempotency}:in_app`,
        }, { onConflict: 'notification_id,channel', ignoreDuplicates: true });
        if (deliveryError) throw deliveryError;
      }

      // Guest registrations still receive their transactional reminder by email.
      if (registration.email) {
        const { data: queuedEmail, error: emailError } = await admin.from('email_messages').upsert({
          recipient_email: registration.email,
          recipient_user_id: registration.user_id,
          organization_id: setting.organization_id,
          event_id: setting.event_id,
          registration_id: registration.id,
          reminder_setting_id: setting.id,
          email_type: 'race_reminder',
          template_version: 1,
          template_snapshot: { type: 'race_reminder', body: content.body, body_format: content.body_format, event_name: setting.events.name, event_date: raceDate },
          subject: content.subject,
          status: 'queued',
          idempotency_key: `${idempotency}:email`,
        }, { onConflict: 'reminder_setting_id,registration_id', ignoreDuplicates: true }).select('id').maybeSingle();
        if (emailError) throw emailError;
        if (queuedEmail) emailCount += 1;
      }
    }

    const { error: dispatchedError } = await admin.from('event_reminder_settings')
      .update({ instructions: encodeReminderContent({ ...content, dispatched_at: now.toISOString() }), enabled: false })
      .eq('id', setting.id).eq('enabled', true);
    if (dispatchedError) throw dispatchedError;
  }

  return { settings: dueSettings, registrations: registrationCount, notifications: notificationCount, emails: emailCount };
}
