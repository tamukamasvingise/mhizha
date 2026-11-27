// Plain dates ('2026-11-27') for accounting dates and the Start date. The
// Business's time zone is Africa/Harare, two hours ahead of UTC all year.

export type PlainDate = string;

export const TIME_ZONE = 'Africa/Harare';
const HARARE_OFFSET_MS = 2 * 60 * 60 * 1000;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** The date in Harare at `ms` (milliseconds since 1970, UTC). */
export function todayAt(ms: number): PlainDate {
  return new Date(ms + HARARE_OFFSET_MS).toISOString().slice(0, 10);
}

function parts(date: PlainDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y!, m!, d!];
}

function fromUtc(t: Date): PlainDate {
  return t.toISOString().slice(0, 10);
}

/** "26 November 2026". */
export function longDate(date: PlainDate): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The date typed as day, month and year, or null if there is no such day. */
export function dateFromParts(day: string, month: string, year: string): PlainDate | null {
  if (!/^\d{1,2}$/.test(day.trim()) || !/^\d{1,2}$/.test(month.trim()) || !/^\d{4}$/.test(year.trim())) return null;
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return fromUtc(t);
}

/** The date `n` months later, on the same day of the month (for the 1st of a month). */
export function addMonths(date: PlainDate, n: number): PlainDate {
  const [y, m, d] = parts(date);
  return fromUtc(new Date(Date.UTC(y, m - 1 + n, d)));
}

/** The day before. */
export function dayBefore(date: PlainDate): PlainDate {
  const [y, m, d] = parts(date);
  return fromUtc(new Date(Date.UTC(y, m - 1, d - 1)));
}

/** The 1st of the date's month. */
export function monthStart(date: PlainDate): PlainDate {
  return `${date.slice(0, 7)}-01`;
}
