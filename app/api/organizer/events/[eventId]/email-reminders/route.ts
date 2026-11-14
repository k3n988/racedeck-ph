import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { decodeReminderContent, encodeReminderContent, reminderHtmlToPlainText, sanitizeReminderHtml } from '@/lib/email/reminder-content';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const REMINDER_KEY = 'organizer_event_reminder';
const REMINDER_TYPES = ['race_reminder', 'race_tomorrow'] as const;
const REMINDER_TYPES_TO_DISABLE = ['race_reminder', 'race_tomorrow', 'custom'] as const;
const leadTimeSchema = z.union([z.literal(10080), z.literal(4320), z.literal(1440)]);
const bodySchema = z.object({
  lead_time_minutes: leadTimeSchema,
  enabled: z.boolean(),
  email_subject: z.string().trim().min(1).max(200),
  email_body: z.string().trim().min(1).max(12000),
  email_body_format: z.enum(['text', 'html']),
});

async function authorize(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership || !(await hasPermission(membership.organization_id, 'manage_email_reminders', eventId))) {
    return { response: NextResponse.json({ error: 'Email reminder permission required' }, { status: 403 }) } as const;
  }
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id,name,event_date')
    .eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, event } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const admin = createAdminClient();
  const [{ data: settings, error }, { data: priorEmail, error: emailError }] = await Promise.all([
    admin.from('event_reminder_settings')
      .select('id,event_id,reminder_key,reminder_type,lead_time_minutes,enabled,instructions,custom_schedule_at,created_at,updated_at')
      .eq('event_id', params.eventId).eq('organization_id', result.event.organization_id)
      .in('reminder_type', REMINDER_TYPES).order('lead_time_minutes', { ascending: false }),
    admin.from('email_messages').select('created_at').eq('event_id', params.eventId)
      .eq('email_type', 'race_reminder').limit(1).maybeSingle(),
  ]);
  if (error || emailError) {
    console.error('Unable to load reminder settings', error ?? emailError);
    return NextResponse.json({ error: 'Reminder settings could not be loaded. Check the Supabase reminder and email migrations.' }, { status: 500 });
  }

  const candidates = settings ?? [];
  const saved = candidates.find((item) => item.reminder_key === REMINDER_KEY)
    ?? candidates.find((item) => item.enabled)
    ?? candidates.find((item) => item.reminder_key === '7_days_before')
    ?? candidates[0]
    ?? null;
  const content = decodeReminderContent(saved?.instructions ?? null, result.event.name);
  const dispatchedAt = content.dispatched_at ?? priorEmail?.created_at ?? null;
  return NextResponse.json({
    event_date: result.event.event_date,
    event_name: result.event.name,
    setting: saved ? {
      id: saved.id,
      reminder_key: saved.reminder_key,
      lead_time_minutes: saved.lead_time_minutes,
      enabled: saved.enabled,
      email_subject: content.subject,
      email_body: content.body,
      email_body_format: content.body_format,
      dispatched_at: dispatchedAt,
    } : null,
  });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid reminder date, subject, and announcement.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: priorEmail, error: emailError } = await admin.from('email_messages').select('id')
    .eq('event_id', params.eventId).eq('email_type', 'race_reminder').limit(1).maybeSingle();
  if (emailError) {
    console.error('Unable to check reminder delivery', emailError);
    return NextResponse.json({ error: 'Reminder delivery status could not be checked' }, { status: 500 });
  }
  if (priorEmail) return NextResponse.json({ error: 'This event reminder has already been queued and cannot be changed.' }, { status: 409 });

  const scheduledAt = new Date(`${result.event.event_date}T00:00:00+08:00`).getTime() - parsed.data.lead_time_minutes * 60_000;
  if (parsed.data.enabled && scheduledAt <= Date.now()) {
    return NextResponse.json({ error: 'That reminder time has already passed. Choose a later reminder time.' }, { status: 400 });
  }

  const { error: disableError } = await admin.from('event_reminder_settings').update({ enabled: false })
    .eq('event_id', params.eventId).eq('organization_id', result.event.organization_id)
    .in('reminder_type', REMINDER_TYPES_TO_DISABLE).neq('reminder_key', REMINDER_KEY);
  if (disableError) {
    console.error('Unable to disable older event reminders', disableError);
    return NextResponse.json({ error: 'Existing reminders could not be replaced' }, { status: 500 });
  }

  const sanitizedBody = parsed.data.email_body_format === 'html' ? sanitizeReminderHtml(parsed.data.email_body) : parsed.data.email_body;
  const plainBody = parsed.data.email_body_format === 'html' ? reminderHtmlToPlainText(sanitizedBody) : sanitizedBody;
  if (!plainBody.trim() || plainBody.length > 4000) {
    return NextResponse.json({ error: 'The announcement must contain 1 to 4,000 characters.' }, { status: 400 });
  }
  const instructions = encodeReminderContent({
    subject: parsed.data.email_subject,
    body: sanitizedBody,
    body_format: parsed.data.email_body_format,
    dispatched_at: null,
  });
  const { data, error } = await admin.from('event_reminder_settings').upsert({
    reminder_key: REMINDER_KEY,
    reminder_type: parsed.data.lead_time_minutes === 1440 ? 'race_tomorrow' : 'race_reminder',
    lead_time_minutes: parsed.data.lead_time_minutes,
    enabled: parsed.data.enabled,
    instructions,
    custom_schedule_at: null,
    organization_id: result.event.organization_id,
    event_id: params.eventId,
  }, { onConflict: 'event_id,reminder_key' }).select('id,reminder_key,lead_time_minutes,enabled,instructions').single();
  if (error) {
    console.error('Unable to save reminder settings', error);
    return NextResponse.json({ error: 'Reminder settings could not be saved' }, { status: 500 });
  }

  return NextResponse.json({ setting: {
    id: data.id,
    reminder_key: data.reminder_key,
    lead_time_minutes: data.lead_time_minutes,
    enabled: data.enabled,
    email_subject: parsed.data.email_subject,
    email_body: sanitizedBody,
    email_body_format: parsed.data.email_body_format,
    dispatched_at: null,
  } });
}
