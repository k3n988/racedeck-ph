export type CategoryPricing = {
  registration_fee: number | string;
  early_bird_fee?: number | string | null;
  early_bird_deadline?: string | null;
};

export function getCategoryPricing(category: CategoryPricing, now = Date.now()) {
  const regularFee = Number(category.registration_fee);
  const earlyBirdFee = category.early_bird_fee == null ? null : Number(category.early_bird_fee);
  const deadline = category.early_bird_deadline ? Date.parse(category.early_bird_deadline) : Number.NaN;
  const earlyBirdActive = earlyBirdFee !== null && Number.isFinite(deadline) && now < deadline;

  return {
    amount: earlyBirdActive ? earlyBirdFee ?? regularFee : regularFee,
    regularFee,
    earlyBirdFee,
    earlyBirdDeadline: category.early_bird_deadline ?? null,
    earlyBirdActive,
  };
}

/** Converts a datetime-local field representing Manila time into a UTC ISO timestamp. */
export function manilaDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Converts a UTC timestamp to the value expected by a datetime-local field in Manila. */
export function isoToManilaDateTime(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function validateEarlyBirdSchedule(input: {
  deadline: string | null | undefined;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  eventDate: string;
}) {
  if (!input.deadline) return null;
  const deadline = Date.parse(input.deadline);
  if (!Number.isFinite(deadline)) return 'Choose a valid Early Bird deadline.';
  if (input.registrationOpensAt && deadline <= Date.parse(input.registrationOpensAt)) return 'Early Bird deadline must be after registration opens.';
  if (input.registrationClosesAt && deadline > Date.parse(input.registrationClosesAt)) return 'Early Bird deadline cannot be after registration closes.';
  const eventEnd = Date.parse(`${input.eventDate}T23:59:59+08:00`);
  if (Number.isFinite(eventEnd) && deadline >= eventEnd) return 'Early Bird deadline must be before the event date ends.';
  return null;
}
