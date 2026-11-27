// Plain dates (YYYY-MM-DD), as stored for the date work finished, follow-ups
// and notes, and how they are shown. "Today" is the day on the phone.

const pad = (n: number) => String(n).padStart(2, '0');

/** The phone's local day of `d` as YYYY-MM-DD. */
export function plainDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => plainDate(new Date());

/** A plain date as a local Date at midnight, for the date picker. */
export function dateOf(plain: string): Date {
  const [y, m, d] = plain.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(plain: string) {
  const [y, m, d] = plain.split('-').map(Number);
  return { y: y!, month: MONTHS[m! - 1]!, d: d! };
}

/** 26 Nov 2026 */
export function shortDate(plain: string): string {
  const { y, month, d } = parts(plain);
  return `${d} ${month.slice(0, 3)} ${y}`;
}

/** 26 November 2026 */
export function longDate(plain: string): string {
  const { y, month, d } = parts(plain);
  return `${d} ${month} ${y}`;
}
