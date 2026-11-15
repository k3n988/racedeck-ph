import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { RACE_KIT_CLAIMING_ITEM } from '@/lib/events/race-kit';
import type { SupabaseClient } from '@supabase/supabase-js';

type RegistrationParams = { params: { eventId: string; registrationId: string } };

export async function GET(_request: Request, { params }: RegistrationParams) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  // Resolve the event first, then authorize against its owning organization.
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id,organization_id,name,registration_personal_fields')
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

  const [categoryResult, answersResult, registrationFieldsResult, historyResult, activityResult, emailsResult, merchandiseResult, ownPaymentResult, bibResult, kitClaimResult, categoryKitResult, sharedKitResult] = await Promise.all([
    admin.from('race_categories')
      .select('id,name,distance_km,registration_fee,early_bird_fee,early_bird_deadline')
      .eq('id', categoryId)
      .eq('event_id', params.eventId)
      .maybeSingle(),
    canViewPii
      ? db.from('registration_responses').select('id,field_id,value,event_registration_fields(id,label,field_type,section_key,event_registration_field_options(label,value))').eq('registration_id', registrationId)
      : Promise.resolve({ data: [], error: null }),
    canViewPii
      ? db.from('event_registration_fields').select('id,label,field_type,section_key,display_order,event_registration_field_options(label,value)').eq('event_id', params.eventId).eq('is_active', true).order('display_order')
      : Promise.resolve({ data: [], error: null }),
    db.from('registration_status_history').select('id,from_status,to_status,reason,changed_by,changed_at').eq('registration_id', registrationId).order('changed_at', { ascending: false }),
    db.from('registration_activity').select('id,action,actor,metadata,created_at').eq('registration_id', registrationId).order('created_at', { ascending: false }),
    canViewPii
      ? db.from('email_messages').select('id,email_type,status,subject,queued_at,sent_at,delivered_at,failure_reason').eq('registration_id', registrationId).eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    db.from('registration_merchandise').select('id,item_name,variant,quantity,unit_price,line_total').eq('registration_id', registrationId).eq('event_id', params.eventId).order('created_at'),
    db.from('payments').select('id,status,amount_due,amount_paid,amount_refunded,currency,metadata,created_at').eq('event_id', params.eventId).eq('registration_id', registrationId).order('created_at', { ascending: false }).limit(1),
    db.from('registrations').select('bibs!registrations_bib_id_fkey(bib_code,bib_number,prefix,status)').eq('id', registrationId).eq('event_id', params.eventId).maybeSingle(),
    db.from('race_kit_claims').select('id,claimed_at').eq('registration_id', registrationId).eq('event_id', params.eventId).order('claimed_at', { ascending: false }).limit(1),
    categoryId ? admin.from('race_kit_configs').select('race_kit_items(id,item_name,details,is_active,display_order)').eq('event_id', params.eventId).eq('category_id', categoryId).eq('status', 'active').order('display_order', { referencedTable: 'race_kit_items' }).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.from('race_kit_configs').select('race_kit_items(id,item_name,details,is_active,display_order)').eq('event_id', params.eventId).is('category_id', null).eq('status', 'active').order('display_order', { referencedTable: 'race_kit_items' }).maybeSingle(),
  ]);

  // Registration itself is the participant's source-of-truth profile. Optional
  // operational history should not prevent organizers from opening that profile.
  const optionalWarnings: string[] = [];
  if (categoryResult.error) optionalWarnings.push('Race category details are unavailable.');
  if (answersResult.error) optionalWarnings.push('Custom participant answers are unavailable.');
  if (registrationFieldsResult.error) optionalWarnings.push('Organizer registration questions are unavailable.');
  if (merchandiseResult.error) optionalWarnings.push('Merchandise selections are unavailable.');
  if (ownPaymentResult.error) optionalWarnings.push('Payment details are unavailable.');
  if (historyResult.error) optionalWarnings.push('Status history is unavailable.');
  if (activityResult.error) optionalWarnings.push('Registration activity is unavailable.');
  if (emailsResult.error) optionalWarnings.push('Email history is unavailable.');
  if (bibResult.error) optionalWarnings.push('Bib assignment is unavailable.');
  if (kitClaimResult.error) optionalWarnings.push('Race kit claim status is unavailable.');
  if (categoryKitResult.error || sharedKitResult.error) optionalWarnings.push('Event inclusions are unavailable.');
  if (optionalWarnings.length) console.warn('Registration profile loaded with optional sections unavailable', optionalWarnings);

  let paymentSnapshot = ownPaymentResult.data?.[0] ?? null;
  let paymentScope: 'participant' | 'checkout_group' | null = paymentSnapshot ? 'participant' : null;
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
      else {
        paymentSnapshot = data?.[0] ?? null;
        if (paymentSnapshot) paymentScope = 'checkout_group';
      }
    }
  }

  const inclusions = [
    ...(sharedKitResult.data?.race_kit_items ?? []),
    ...(categoryKitResult.data?.race_kit_items ?? []),
  ].filter((item) => item.is_active && item.item_name?.trim())
    .sort((left, right) => Number(left.display_order ?? 0) - Number(right.display_order ?? 0))
    .map((item) => ({ id: item.id, item_name: item.item_name, details: item.details }))
    .filter((item) => item.item_name.toLocaleLowerCase() !== RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase());
  const responseByFieldId = new Map((answersResult.data ?? []).map((answer) => [answer.field_id, answer]));
  const activeFieldIds = new Set((registrationFieldsResult.data ?? []).map((field) => field.id));
  const answers = [
    ...(registrationFieldsResult.data ?? []).map((field) => {
      const response = responseByFieldId.get(field.id);
      return {
        id: response?.id ?? `unanswered-${field.id}`,
        field_id: field.id,
        value: response?.value ?? null,
        event_registration_fields: { id: field.id, label: field.label, field_type: field.field_type, section_key: field.section_key },
        event_registration_field_options: field.event_registration_field_options ?? [],
      };
    }),
    ...(answersResult.data ?? []).filter((answer) => !activeFieldIds.has(answer.field_id)).map((answer) => {
      const joinedField = Array.isArray(answer.event_registration_fields) ? answer.event_registration_fields[0] : answer.event_registration_fields;
      return {
        ...answer,
        event_registration_fields: joinedField ?? null,
        event_registration_field_options: joinedField?.event_registration_field_options ?? [],
      };
    }),
  ];

  return NextResponse.json({
    event: { id: event.id, name: event.name },
    registrationPersonalFields: event.registration_personal_fields ?? null,
    registration,
    category: categoryResult.data ?? null,
    answers,
    history: historyResult.data ?? [],
    activity: activityResult.data ?? [],
    emails: emailsResult.data ?? [],
    merchandise: merchandiseResult.data ?? [],
    inclusions,
    paymentSnapshot,
    paymentScope,
    bib: (bibResult.data as unknown as { bibs?: { bib_code?: string | null; bib_number?: number | null; prefix?: string | null; status?: string | null } | null } | null)?.bibs ?? null,
    raceKitClaimedAt: kitClaimResult.data?.[0]?.claimed_at ?? null,
    canViewPii,
    canManageRegistrations,
    warnings: optionalWarnings,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
