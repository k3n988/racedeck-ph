import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import { effectiveAvailability } from '@/lib/public/events';
const EVENT_FIELDS = 'id,organization_id,slug,name,banner_url,event_date,venue,address,lifecycle_status,review_status,registration_availability,registration_opens_at,registration_closes_at,overall_capacity,is_featured,created_at,updated_at';
export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_events');
  if ('response' in auth) return auth.response;

  try {
    const params = new URL(request.url).searchParams;
    const search = params.get('search')?.trim();
    const lifecycleStatus = params.get('lifecycle_status')?.trim();
    const eventId = params.get('eventId')?.trim();
    const from = params.get('from');
    const to = params.get('to');
    let query = auth.admin
      .from('events')
      .select(EVENT_FIELDS, { count: 'exact' })
      .eq('organization_id', auth.membership.organization_id)
      .order('event_date', { ascending: true });

    if (auth.membership.restricted_event_ids) query = query.in('id', auth.membership.restricted_event_ids);
    if (search) query = query.ilike('name', `%${search.replace(/[%_]/g, '\\$&')}%`);
    if (eventId) query = query.eq('id', eventId);
    const allowedStatuses = ['draft', 'published', 'ongoing', 'completed', 'cancelled', 'archived'];
    const lifecycleStatuses = lifecycleStatus?.split(',').map((status) => status.trim()).filter((status) => allowedStatuses.includes(status));
    if (lifecycleStatuses?.length === 1) query = query.eq('lifecycle_status', lifecycleStatuses[0] as never);
    else if (lifecycleStatuses && lifecycleStatuses.length > 1) query = query.in('lifecycle_status', lifecycleStatuses as never);
    const fromTime = from ? Date.parse(from) : Number.NaN;
    const toTime = to ? Date.parse(to) : Number.NaN;
    if (Number.isFinite(fromTime)) query = query.gte('created_at', new Date(fromTime).toISOString());
    if (Number.isFinite(toTime)) query = query.lte('created_at', new Date(toTime).toISOString());
    const { data: events, count, error } = await query;
    if (error) return errorResponse(error, 'Organizer events query');

    const ids = (events ?? []).map((event) => event.id);
    const [registrationsResult, paymentsResult, categoriesResult] = await Promise.all([
      ids.length
        ? auth.admin.from('registrations').select('event_id,status').in('event_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? auth.admin.from('payments').select('event_id,amount_paid,amount_refunded,status').in('event_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? auth.admin.from('race_categories').select('event_id,max_slots,confirmed_count').in('event_id', ids)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (registrationsResult.error) return errorResponse(registrationsResult.error, 'Event registrations query');
    if (paymentsResult.error) return errorResponse(paymentsResult.error, 'Event payments query');
    if (categoriesResult.error) return errorResponse(categoriesResult.error, 'Event categories query');

    const registrations = registrationsResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const categories = categoriesResult.data ?? [];

    return NextResponse.json({
      events: (events ?? []).map((event) => {
        const eventCategories = categories.filter((row) => row.event_id === event.id);
        const categoryCapacity = eventCategories.some((row) => row.max_slots === null)
          ? null
          : eventCategories.reduce((sum, row) => sum + Number(row.max_slots ?? 0), 0);
        return {
        ...event,
        registration_availability: effectiveAvailability(event),
        registrations_count: registrations.filter((row) => row.event_id === event.id).length,
        confirmed_count: registrations.filter((row) => row.event_id === event.id && row.status === 'confirmed').length,
        gross_sales: payments
          .filter((row) => row.event_id === event.id && ['succeeded', 'partially_refunded', 'refunded'].includes(row.status))
          .reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0),
        capacity: eventCategories.length ? categoryCapacity : event.overall_capacity,
      }; }),
      total: count ?? 0,
    });
  } catch (error) {
    return errorResponse(error, 'Organizer events request');
  }
}
export async function POST(request: Request) {
  const auth = await requireOrganizerPermission('create_events');
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const eventDate = typeof body.event_date === 'string' ? body.event_date : '';
    const socialLinks = body.social_links && typeof body.social_links === 'object' && !Array.isArray(body.social_links) ? body.social_links : {};
    for (const field of ['facebook', 'website'] as const) {
      const value = socialLinks[field];
      if (typeof value === 'string' && value.trim()) {
        if (value.trim().length > 2048) return NextResponse.json({ error: `${field === 'facebook' ? 'Facebook' : 'Website'} URL is too long` }, { status: 400 });
        try {
          const url = new URL(value.trim());
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
        } catch {
          return NextResponse.json({ error: `${field === 'facebook' ? 'Facebook' : 'Website'} must be a valid HTTP or HTTPS URL` }, { status: 400 });
        }
      } else if (value != null && typeof value !== 'string') {
        return NextResponse.json({ error: `Invalid ${field} URL` }, { status: 400 });
      }
    }
    const phone = socialLinks.phone;
    if (typeof phone === 'string' && phone.trim() && (phone.trim().length > 24 || !/^[+\d().\s-]+$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) {
      return NextResponse.json({ error: 'Phone number must contain 7 to 15 digits' }, { status: 400 });
    }

    const parsedDay = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T00:00:00Z`) : null;
    if (!name || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 ||
      !parsedDay || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== eventDate) {
      return NextResponse.json({ error: 'Name, slug, and event date are required' }, { status: 400 });
    }

    const opensAt = typeof body.registration_opens_at === 'string' ? Date.parse(body.registration_opens_at) : null;
    const closesAt = typeof body.registration_closes_at === 'string' ? Date.parse(body.registration_closes_at) : null;
    const eventDayEnd = Date.parse(`${eventDate}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
    if ((opensAt !== null || closesAt !== null) &&
      (opensAt === null || closesAt === null || !Number.isFinite(opensAt) || !Number.isFinite(closesAt) || opensAt >= closesAt || closesAt > eventDayEnd)) {
      return NextResponse.json({ error: 'Registration must have valid opening and closing dates, in order, closing no later than the event day.' }, { status: 400 });
    }
    if (body.overall_capacity != null && (!Number.isInteger(body.overall_capacity) || body.overall_capacity <= 0 || body.overall_capacity > 2147483647)) {
      return NextResponse.json({ error: 'Overall capacity must be a positive whole number within the supported limit.' }, { status: 400 });
    }
    const timeFields = ['start_time', 'assembly_time', 'gun_start_time', 'cutoff_time'] as const;
    for (const field of timeFields) {
      const value = body[field];
      if (value !== undefined && value !== null && value !== '' &&
        (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value))) {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be a valid time` }, { status: 400 });
      }
    }

    const { data, error } = await auth.admin.from('events').insert({
      organization_id: auth.membership.organization_id,
      name,
      slug,
      event_date: eventDate,
      lifecycle_status: 'draft',
      review_status: 'not_submitted',
      venue: typeof body.venue === 'string' ? body.venue.trim() || null : null,
      address: typeof body.address === 'string' ? body.address.trim() || null : null,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      start_time: typeof body.start_time === 'string' ? body.start_time || null : null,
      social_links: {
        facebook: typeof socialLinks.facebook === 'string' ? socialLinks.facebook.trim() : '',
        phone: typeof socialLinks.phone === 'string' ? socialLinks.phone.trim() : '',
        website: typeof socialLinks.website === 'string' ? socialLinks.website.trim() : '',
      } as never,
      registration_opens_at: typeof body.registration_opens_at === 'string' ? body.registration_opens_at : null,
      registration_closes_at: typeof body.registration_closes_at === 'string' ? body.registration_closes_at : null,
      assembly_time: typeof body.assembly_time === 'string' ? body.assembly_time || null : null,
      gun_start_time: typeof body.gun_start_time === 'string' ? body.gun_start_time || null : null,
      cutoff_time: typeof body.cutoff_time === 'string' ? body.cutoff_time || null : null,
      overall_capacity: Number.isFinite(body.overall_capacity) ? body.overall_capacity : null,
      created_by: auth.context.user.id,
    }).select(EVENT_FIELDS).single();

    if (error) {
      console.error('[Creating organizer event]', error);
      return NextResponse.json(
        { error: error.code === '23505'
          ? 'Event slug already exists'
          : process.env.NODE_ENV === 'development'
            ? `Event creation failed: ${error.message}`
            : 'Event could not be created' },
        { status: error.code === '23505' ? 409 : 500 },
      );
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Creating organizer event');
  }
}
