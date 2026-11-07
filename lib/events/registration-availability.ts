export type RegistrationAvailability = 'not_yet_open' | 'open' | 'closing_soon' | 'closed' | 'sold_out';

export type RegistrationWindow = {
  registration_availability: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  event_date?: string | null;
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
