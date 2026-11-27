// The Accounting period: how often the records are reviewed, counted from the
// month the year starts.
import { addMonths, dayBefore, MONTHS, monthStart, type PlainDate } from './dates';

/** `every` is the length in months; `yearStarts` is 1 (January) to 12. */
export type PeriodSetting = { every: 1 | 3 | 12; yearStarts: number };

export const DEFAULT_PERIOD: PeriodSetting = { every: 1, yearStarts: 1 };

export const PERIOD_CHOICES: readonly { every: PeriodSetting['every']; label: string }[] = [
  { every: 1, label: 'Every month' },
  { every: 3, label: 'Every 3 months' },
  { every: 12, label: 'Every year' },
];

/** The first and last day of the period `date` falls in. */
export function periodContaining(date: PlainDate, s: PeriodSetting): { start: PlainDate; end: PlainDate } {
  const month = Number(date.slice(5, 7));
  const sinceYearStart = (month - s.yearStarts + 12) % 12;
  const start = addMonths(monthStart(date), -(sinceYearStart % s.every));
  return { start, end: dayBefore(addMonths(start, s.every)) };
}

/** The first day of the period after the one `date` falls in. */
export function nextPeriodStart(date: PlainDate, s: PeriodSetting): PlainDate {
  return addMonths(periodContaining(date, s).start, s.every);
}

/** "Every 3 months, year starts in March". */
export function periodLabel(s: PeriodSetting): string {
  const every = PERIOD_CHOICES.find((c) => c.every === s.every)?.label ?? 'Every month';
  return `${every}, year starts in ${MONTHS[s.yearStarts - 1]}`;
}
