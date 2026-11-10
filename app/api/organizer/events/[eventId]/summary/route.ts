import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import { effectiveRegistrationAvailability, registrationAvailabilityReason } from '@/lib/events/registration-availability';
import { eventPlatformLinkIsValid, eventPhoneIsValid, type EventSocialLinks } from '@/lib/events/event-social-links';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUMMARY_FIELDS = 'id,organization_id,name,description,address,event_date,start_time,venue,social_links,lifecycle_status,review_status,registration_availability,registration_opens_at,registration_closes_at,overall_capacity,review_feedback';

function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const { data: event, error } = await auth.admin
      .from('events')
      .select(SUMMARY_FIELDS)
      .eq('id', params.eventId)
      .eq('organization_id', auth.membership.organization_id)
      .maybeSingle();
    if (error) return errorResponse(error, 'Loading organizer event summary');
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const [{ data: categories, error: categoriesError }, { data: organization, error: organizationError }] = await Promise.all([
      auth.admin.from('race_categories').select('id,name,distance_km,registration_fee,max_slots,confirmed_count,registration_availability').eq('event_id', params.eventId),
      auth.admin.from('organizations').select('verification_status,account_status').eq('id', event.organization_id).maybeSingle(),
    ]);
    if (categoriesError) return errorResponse(categoriesError, 'Checking event setup readiness');
    if (organizationError) return errorResponse(organizationError, 'Checking organizer readiness');

    const plainDescription = (event.description ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    const eventEnd = Date.parse(`${event.event_date}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
    const opensAt = event.registration_opens_at ? Date.parse(event.registration_opens_at) : NaN;
    const closesAt = event.registration_closes_at ? Date.parse(event.registration_closes_at) : NaN;
    const validSchedule = Number.isFinite(opensAt) && Number.isFinite(closesAt) && opensAt < closesAt && closesAt <= eventEnd;
    const completeCategories = (categories ?? []).length > 0 && (categories ?? []).every((category) => (
      Boolean(category.name?.trim()) && Number.isFinite(Number(category.distance_km)) && Number(category.distance_km) > 0
      && Number.isFinite(Number(category.registration_fee)) && Number(category.registration_fee) >= 0
      && (category.max_slots == null || (Number.isInteger(category.max_slots) && category.max_slots > 0))
    ));
    const organizationReady = organization?.verification_status === 'approved' && organization.account_status === 'active';
    const eventDetailsReady = Boolean(event.name.trim() && plainDescription && event.venue?.trim() && event.address?.trim());
    const contact = (event.social_links ?? {}) as EventSocialLinks;
    const contactReady = Boolean(contact.phone?.trim() && eventPlatformLinkIsValid('facebook', contact.facebook ?? '') && eventPhoneIsValid(contact.phone ?? ''));
    const upcoming = Boolean(event.event_date && event.event_date >= manilaToday());
    const checklist = [
      { label: 'Event details', href: 'setup/details', complete: eventDetailsReady, detail: eventDetailsReady ? 'Name, description, venue, and address are set.' : 'Add the event name, description, venue, and complete address.' },
      { label: 'Event contact', href: 'setup/details', complete: contactReady, detail: contactReady ? 'Facebook and phone number are set.' : 'Add a valid Facebook URL and phone number.' },
      { label: 'Event date and registration schedule', href: 'settings', complete: upcoming && validSchedule, detail: !upcoming ? 'The event date must be today or later (Philippine time).' : !validSchedule ? 'Set opening and closing dates in order, ending by the event day.' : 'Dates are valid and use Philippine time.' },
      { label: 'At least one complete category', href: 'setup/categories-pricing', complete: completeCategories, detail: completeCategories ? `${categories?.length ?? 0} complete race ${categories?.length === 1 ? 'category' : 'categories'}.` : 'Add a category with a name, distance, fee, and valid capacity.' },
      { label: 'Organizer approved and active', href: 'settings', complete: organizationReady, detail: organizationReady ? 'The organization can submit events for review.' : 'The organization must be approved and active before event submission.' },
    ];
    const eventForAvailability = { ...event, registration_availability: event.registration_availability, event_date: event.event_date };
    const scheduledAvailability = effectiveRegistrationAvailability(eventForAvailability);
    const publiclyRegistrable = event.lifecycle_status === 'published' && event.review_status === 'approved';
    const effectiveAvailability = publiclyRegistrable ? scheduledAvailability : 'unavailable';
    const categoryOpen = (categories ?? []).some((category) => !['closed', 'sold_out'].includes(category.registration_availability) && (category.max_slots == null || category.confirmed_count < category.max_slots));
    const overallCapacityReached = event.overall_capacity != null && (categories ?? []).reduce((sum, category) => sum + (category.confirmed_count ?? 0), 0) >= event.overall_capacity;
    const registrationReason = !publiclyRegistrable
      ? event.lifecycle_status !== 'published'
        ? 'This event is not published yet.'
        : 'RaceDeck approval is required before participants can register.'
      : overallCapacityReached
        ? 'Event capacity has been reached.'
        : effectiveAvailability === 'open' && !categoryOpen
          ? 'Registration is open by schedule, but every category is closed or full.'
          : registrationAvailabilityReason(eventForAvailability);
    const canSubmit = checklist.every((item) => item.complete);

    return NextResponse.json({
      event: {
        ...event,
        effective_registration_availability: effectiveAvailability,
        registration_availability_reason: registrationReason,
      },
      checklist,
      can_submit: canSubmit,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'Organizer event summary request');
  }
}
