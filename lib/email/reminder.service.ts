import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

type ReminderSetting = { id: string; event_id: string; organization_id: string; reminder_key: string; reminder_type: 'race_reminder' | 'race_tomorrow' | 'race_kit_claiming_deadline' | 'custom'; lead_time_minutes: number; custom_schedule_at: string | null; events: { id: string; name: string; event_date: string } | null };
function dueAt(setting: ReminderSetting): Date { if (setting.custom_schedule_at) return new Date(setting.custom_schedule_at); return new Date(new Date(`${setting.events?.event_date ?? 'invalid'}T00:00:00.000Z`).getTime() - setting.lead_time_minutes * 60_000); }

export async function dispatchDueReminders(limit = 20): Promise<{ settings: number; registrations: number; notifications: number; emails: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const { data: settings, error } = await admin.from('event_reminder_settings').select('id,event_id,organization_id,reminder_key,reminder_type,lead_time_minutes,custom_schedule_at,events(id,name,event_date)').eq('enabled', true).limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;
  let registrationCount = 0; let notificationCount = 0; let emailCount = 0;
  for (const setting of (settings ?? []) as unknown as ReminderSetting[]) {
    if (!setting.events || Number.isNaN(dueAt(setting).getTime()) || dueAt(setting) > now) continue;
    const { data: registrations, error: registrationError } = await admin.from('registrations').select('id,user_id,email').eq('event_id', setting.event_id).eq('status', 'confirmed').limit(500);
    if (registrationError) throw registrationError;
    registrationCount += registrations?.length ?? 0;
    const notificationType = setting.reminder_type === 'race_tomorrow' ? 'race_tomorrow' : setting.reminder_type === 'race_kit_claiming_deadline' ? 'race_kit_claiming_deadline' : 'event_reminder';
    for (const registration of registrations ?? []) {
      if (!registration.user_id) continue;
      const idempotency = `reminder:${setting.id}:${registration.id}`;
      const { data: notification, error: notificationError } = await admin.from('notifications').upsert({ recipient_user_id: registration.user_id, organization_id: setting.organization_id, event_id: setting.event_id, registration_id: registration.id, reminder_setting_id: setting.id, notification_type: notificationType, title: `${setting.events.name} reminder`, body: 'Your upcoming race is approaching. Check your RaceDeck registration for details.', metadata: { reminder_key: setting.reminder_key }, idempotency_key: idempotency }, { onConflict: 'reminder_setting_id,registration_id', ignoreDuplicates: true }).select('id,recipient_user_id').maybeSingle();
      if (notificationError) throw notificationError;
      if (notification) { notificationCount += 1; const { error: deliveryError } = await admin.from('notification_deliveries').upsert({ notification_id: notification.id, recipient_user_id: notification.recipient_user_id, channel: 'in_app', status: 'queued', idempotency_key: `${idempotency}:in_app` }, { onConflict: 'notification_id,channel', ignoreDuplicates: true }); if (deliveryError) throw deliveryError; }
      if (registration.email) {
        const { error: emailError } = await admin.from('email_messages').upsert({ recipient_email: registration.email, recipient_user_id: registration.user_id, organization_id: setting.organization_id, event_id: setting.event_id, registration_id: registration.id, reminder_setting_id: setting.id, email_type: 'race_reminder', template_version: 1, template_snapshot: { type: 'race_reminder', body: 'Your upcoming race is approaching. Check your RaceDeck registration for details.' }, subject: `${setting.events.name} reminder`, status: 'queued', idempotency_key: `${idempotency}:email` }, { onConflict: 'reminder_setting_id,registration_id', ignoreDuplicates: true });
        if (emailError) throw emailError;
        emailCount += 1;
      }
    }
  }
  return { settings: settings?.length ?? 0, registrations: registrationCount, notifications: notificationCount, emails: emailCount };
}
