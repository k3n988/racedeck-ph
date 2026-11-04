export function adminPageNumber(value?: string) {
  return Math.min(100000, Math.max(1, Number.parseInt(value ?? '1', 10) || 1));
}

export function adminSearch(value?: string) {
  return (value ?? '').trim().slice(0, 100).replace(/[,%()]/g, ' ').trim();
}

function manilaDate(value?: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() + 1 !== Number(month) || check.getUTCDate() !== Number(day)) return undefined;
  return new Date(`${value}T00:00:00+08:00`);
}

export function adminDateRange(from?: string, to?: string) {
  const start = manilaDate(from);
  const end = manilaDate(to);
  if (start === undefined || end === undefined) return { from: null, toExclusive: null, error: 'Enter valid From and To dates.' };
  if (start && end && start > end) return { from: null, toExclusive: null, error: 'From must be on or before To.' };
  return { from: start?.toISOString() ?? null, toExclusive: end ? new Date(end.getTime() + 86400000).toISOString() : null, error: null };
}
