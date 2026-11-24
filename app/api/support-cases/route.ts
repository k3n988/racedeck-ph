import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const reportSchema = z.object({
  case_type: z.enum(['general_account', 'event', 'registration', 'payment', 'refund', 'race_kit']),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(5000),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  registration_number: z.string().trim().min(3).max(80).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the report details and try again.' }, { status: 400 });
  }

  const { case_type, subject, description, email, registration_number } = parsed.data;
  const auth = await loadAuthContext();
  const admin = createAdminClient();
  let requesterUserId: string | null = auth?.user.id ?? null;
  const requesterEmail = auth?.user.email?.trim().toLowerCase() ?? email?.trim().toLowerCase() ?? '';
  let requesterOrganizationId: string | null = null;
  let organizationId: string | null = null;
  let eventId: string | null = null;
  let registrationId: string | null = null;

  const organizerMembership = auth?.memberships[0];
  if (organizerMembership) {
    requesterOrganizationId = organizerMembership.organization_id;
    organizationId = organizerMembership.organization_id;
  } else {
    if (!registration_number || !requesterEmail) {
      return NextResponse.json({ error: 'Enter the email used for your registration and its registration number.' }, { status: 400 });
    }
    const { data: registration } = await admin
      .from('registrations')
      .select('id,user_id,email,event_id')
      .eq('registration_number', registration_number)
      .maybeSingle();
    if (!registration || registration.email.trim().toLowerCase() !== requesterEmail) {
      return NextResponse.json({ error: 'We could not match that registration number and email.' }, { status: 404 });
    }
    if (auth && registration.user_id && registration.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'This registration belongs to a different account.' }, { status: 403 });
    }
    // Guest registration reports stay attached to the verified email, rather than
    // being attributed to an unrelated account that may own the registration.
    requesterUserId = auth && registration.user_id === auth.user.id ? auth.user.id : null;
    registrationId = registration.id;
    eventId = registration.event_id;
    const { data: event } = await admin.from('events').select('organization_id').eq('id', eventId).maybeSingle();
    organizationId = event?.organization_id ?? null;
  }

  if (!requesterEmail) {
    return NextResponse.json({ error: 'A contact email is required to submit a report.' }, { status: 400 });
  }

  const reference = `SUP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: supportCase, error } = await admin.from('support_cases').insert({
    case_reference: reference,
    requester_user_id: requesterUserId,
    requester_email: requesterEmail,
    requester_organization_id: requesterOrganizationId,
    case_type,
    subject,
    description,
    organization_id: organizationId,
    event_id: eventId,
    registration_id: registrationId,
  }).select('id,case_reference').single();

  if (error || !supportCase) {
    console.error('Support case submission failed', error);
    return NextResponse.json({ error: 'Your report could not be submitted. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ id: supportCase.id, case_reference: supportCase.case_reference }, { status: 201 });
}
