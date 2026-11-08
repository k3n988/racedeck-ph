export type RegistrationAvailability = 'not_yet_open' | 'open' | 'closing_soon' | 'closed' | 'sold_out';

export type RegistrationWindow = {
  registration_availability: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  event_date?: string | null;
};

export type CategoryRegistrationWindow = RegistrationWindow & {
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  max_slots?: number | null;
  confirmed_count?: number;
};

export function effectiveRegistrationAvailability(event: RegistrationWindow, now = Date.now()): RegistrationAvailability {
  if (event.registration_availability === 'sold_out') return 'sold_out';

  const opensAt = event.registration_opens_at ? Date.parse(event.registration_opens_at) : NaN;
  const closesAt = event.registration_closes_at ? Date.parse(event.registration_closes_at) : NaN;
  if (Number.isFinite(opensAt) && now < opensAt) return 'not_yet_open';
  if (Number.isFinite(closesAt) && now >= closesAt) return 'closed';

  if (event.event_date && /^\d{4}-\d{2}-\d{2}$/.test(event.event_date)) {
    const eventDayEnd = Date.parse(`${event.event_date}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
    if (Number.isFinite(eventDayEnd) && now >= eventDayEnd) return 'closed';
  }

  if (event.registration_availability === 'closed') return 'closed';
  if (event.registration_availability === 'not_yet_open' && !Number.isFinite(opensAt)) return 'not_yet_open';
  if (Number.isFinite(opensAt) || Number.isFinite(closesAt)) return 'open';
  return event.registration_availability === 'open' ? 'open' : 'closed';
}

export function registrationAvailabilityReason(event: RegistrationWindow, now = Date.now()): string {
  const availability = effectiveRegistrationAvailability(event, now);
  const formatManila = (value: string) => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));

  if (availability === 'sold_out') return 'Registration is sold out.';
  if (availability === 'not_yet_open') {
    return event.registration_opens_at && Number.isFinite(Date.parse(event.registration_opens_at))
      ? `Registration opens ${formatManila(event.registration_opens_at)} (Philippine time).`
      : 'Registration has not opened yet. Set an opening date or change the manual availability setting.';
  }
  if (availability === 'closed') {
    if (event.registration_closes_at && Number.isFinite(Date.parse(event.registration_closes_at)) && now >= Date.parse(event.registration_closes_at)) {
      return `Registration closed ${formatManila(event.registration_closes_at)} (Philippine time).`;
    }
    if (event.event_date) {
      const eventDayEnd = Date.parse(`${event.event_date}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
      if (Number.isFinite(eventDayEnd) && now >= eventDayEnd) return 'This event date has passed, so registration is closed.';
    }
    return 'Registration is closed by the organizer.';
  }
  return 'Registration is open according to the saved event schedule.';
}

/**
 * Resolve a distance's registration state. A complete distance-level window
 * replaces the event window; manual event/category closures and capacity
 * limits remain authoritative. Dates are stored as timestamptz and compared
 * as absolute instants, with the organizer UI converting Manila local times.
 */
export function effectiveCategoryAvailability(
  category: CategoryRegistrationWindow,
  event: RegistrationWindow,
  now = Date.now(),
): RegistrationAvailability {
  if (category.registration_availability === 'sold_out' || event.registration_availability === 'sold_out') return 'sold_out';
  if (category.registration_availability === 'closed' || event.registration_availability === 'closed') return 'closed';
  if (category.max_slots !== null && category.max_slots !== undefined && (category.confirmed_count ?? 0) >= category.max_slots) return 'sold_out';

  const hasCategoryWindow = Boolean(category.registration_opens_at && category.registration_closes_at);
  return effectiveRegistrationAvailability(hasCategoryWindow ? {
    registration_availability: 'open',
    registration_opens_at: category.registration_opens_at ?? null,
    registration_closes_at: category.registration_closes_at ?? null,
    event_date: event.event_date,
  } : event, now);
}

export function categoryRegistrationAvailabilityReason(
  category: CategoryRegistrationWindow,
  event: RegistrationWindow,
  now = Date.now(),
) {
  const availability = effectiveCategoryAvailability(category, event, now);
  if (availability === 'sold_out') return 'This race distance is sold out.';
  if (availability === 'not_yet_open') {
    const opensAt = category.registration_opens_at ?? event.registration_opens_at;
    return opensAt ? `Registration opens ${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(opensAt))} (Philippine time).` : 'Registration has not opened yet.';
  }
  if (availability === 'closed') {
    const closesAt = category.registration_closes_at ?? event.registration_closes_at;
    if (closesAt && now >= Date.parse(closesAt)) return `Registration closed ${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(closesAt))} (Philippine time).`;
    return registrationAvailabilityReason(event, now);
  }
  return 'Registration is open for this race distance.';
}
