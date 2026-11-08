import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type RegistrationParams = { params: { eventId: string; registrationId: string } };

export async function GET(_request: Request, { params }: RegistrationParams) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  // Resolve the event first, then authorize against its owning organization.
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id,organization_id,name')
    .eq('id', params.eventId)
    .maybeSingle();
  if (eventError) {
    console.error('Unable to verify registration event access', eventError);
    return NextResponse.json({ error: 'Event access could not be verified' }, { status: 500 });
  }
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const canManageRegistrations = await hasPermission(event.organization_id, 'manage_registrations', params.eventId);
  const canViewPii = await hasPermission(event.organization_id, 'view_participants', params.eventId);
  if (!canManageRegistrations && !canViewPii) {
    return NextResponse.json({ error: 'Registration access permission required' }, { status: 403 });
  }

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const baseResult = canViewPii
    ? await admin.from('registrations').select('id,registration_number,event_id,category_id,status,first_name,last_name,birthdate,email,mobile,address,emergency_contact_name,emergency_contact_number,shirt_size,competition_classification,created_at,updated_at').eq('id', params.registrationId).eq('event_id', params.eventId).maybeSingle()
    : await admin.from('registrations').select('id,registration_number,event_id,category_id,status,created_at,updated_at').eq('id', params.registrationId).eq('event_id', params.eventId).maybeSingle();
  const baseRegistration = baseResult.data as unknown as Record<string, unknown> | null;
  const registrationError = baseResult.error;
  if (registrationError) {
    console.error('Unable to load registration profile', registrationError);
    return NextResponse.json({ error: 'Participant profile could not be loaded' }, { status: 500 });
  }
  if (!baseRegistration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  const registrationId = typeof baseRegistration.id === 'string' ? baseRegistration.id : params.registrationId;
  const categoryId = typeof baseRegistration.category_id === 'string' ? baseRegistration.category_id : '';

  // These fields were added in later migrations. Keep the core profile usable
  // if an environment has not applied one of those optional migrations yet.
  const optionalRegistrationFields: Record<string, unknown> = {};
  const optionalFieldNames = canViewPii
    ? ['middle_name', 'gender', 'emergency_contact_relationship', 'checkout_group_id']
    : ['checkout_group_id'];
  const optionalFieldResults = await Promise.all(optionalFieldNames.map((field) => db.from('registrations')
    .select(`id,${field}`)
    .eq('id', registrationId)
    .eq('event_id', params.eventId)
    .maybeSingle()));
  optionalFieldResults.forEach((result, index) => {
    const field = optionalFieldNames[index];
    if (result.error) console.warn(`Optional participant field ${field} is unavailable`, result.error.code);
    else if (result.data) optionalRegistrationFields[field] = (result.data as unknown as Record<string, unknown>)[field];
  });
  const registration = { ...baseRegistration, ...optionalRegistrationFields };
  const checkoutGroupId = typeof registration.checkout_group_id === 'string' ? registration.checkout_group_id : null;

  const [categoryResult, answersResult, historyResult, activityResult, emailsResult, merchandiseResult, ownPaymentResult] = await Promise.all([
    admin.from('race_categories')
      .select('id,name,distance_km,registration_fee,early_bird_fee,early_bird_deadline')
      .eq('id', categoryId)
      .eq('event_id', params.eventId)
      .maybeSingle(),
    canViewPii
      ? db.from('registration_responses').select('id,field_id,value,event_registration_fields(label,field_type,section_key),event_registration_field_options(label,value)').eq('registration_id', registrationId)
      : Promise.resolve({ data: [], error: null }),
    db.from('registration_status_history').select('id,from_status,to_status,reason,changed_by,changed_at').eq('registration_id', registrationId).order('changed_at', { ascending: false }),
    db.from('registration_activity').select('id,action,actor,metadata,created_at').eq('registration_id', registrationId).order('created_at', { ascending: false }),
    canViewPii
      ? db.from('email_messages').select('id,email_type,status,subject,queued_at,sent_at,delivered_at,failure_reason').eq('registration_id', registrationId).eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    db.from('registration_merchandise').select('id,item_name,variant,quantity,unit_price,line_total').eq('registration_id', registrationId).eq('event_id', params.eventId).order('created_at'),
    db.from('payments').select('id,status,amount_due,amount_paid,amount_refunded,currency,metadata,created_at').eq('event_id', params.eventId).eq('registration_id', registrationId).order('created_at', { ascending: false }).limit(1),
  ]);

  // Registration itself is the participant's source-of-truth profile. Optional
  // operational history should not prevent organizers from opening that profile.
  const optionalWarnings: string[] = [];
  if (categoryResult.error) optionalWarnings.push('Race category details are unavailable.');
  if (answersResult.error) optionalWarnings.push('Custom participant answers are unavailable.');
  if (merchandiseResult.error) optionalWarnings.push('Merchandise selections are unavailable.');
  if (ownPaymentResult.error) optionalWarnings.push('Payment details are unavailable.');
  if (historyResult.error) optionalWarnings.push('Status history is unavailable.');
  if (activityResult.error) optionalWarnings.push('Registration activity is unavailable.');
  if (emailsResult.error) optionalWarnings.push('Email history is unavailable.');
  if (optionalWarnings.length) console.warn('Registration profile loaded with optional sections unavailable', optionalWarnings);

  let paymentSnapshot = ownPaymentResult.data?.[0] ?? null;
  if (!paymentSnapshot && checkoutGroupId) {
    const { data: siblingRows, error: siblingError } = await db.from('registrations')
      .select('id')
      .eq('event_id', params.eventId)
      .eq('checkout_group_id', checkoutGroupId);
    if (!siblingError && siblingRows?.length) {
      const { data, error } = await db.from('payments')
        .select('id,status,amount_due,amount_paid,amount_refunded,currency,metadata,created_at')
        .eq('event_id', params.eventId)
        .in('registration_id', siblingRows.map((row: { id: string }) => row.id))
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) optionalWarnings.push('Grouped checkout payment details are unavailable.');
      else paymentSnapshot = data?.[0] ?? null;
    }
  }

  return NextResponse.json({
    event: { id: event.id, name: event.name },
    registration,
    category: categoryResult.data ?? null,
    answers: answersResult.data ?? [],
    history: historyResult.data ?? [],
    activity: activityResult.data ?? [],
    emails: emailsResult.data ?? [],
    merchandise: merchandiseResult.data ?? [],
    paymentSnapshot,
    canViewPii,
    canManageRegistrations,
    warnings: optionalWarnings,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
