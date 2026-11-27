import { describe, expect, it } from 'vitest';
import { addMonths, dateFromParts, longDate, todayAt } from './dates';
import { nextPeriodStart, periodContaining, periodLabel, type PeriodSetting } from './period';

describe('plain dates', () => {
  it('takes today in Harare time, two hours ahead of UTC', () => {
    expect(todayAt(Date.UTC(2026, 10, 27, 21, 59))).toBe('2026-11-27');
    expect(todayAt(Date.UTC(2026, 10, 27, 22, 0))).toBe('2026-11-28');
  });

  it('writes a date out in full', () => {
    expect(longDate('2026-11-26')).toBe('26 November 2026');
    expect(longDate('2027-01-01')).toBe('1 January 2027');
  });

  it('reads a day, month and year typed by the User', () => {
    expect(dateFromParts('5', '3', '2026')).toBe('2026-03-05');
    expect(dateFromParts('29', '2', '2028')).toBe('2028-02-29');
  });

  it('refuses a day that does not exist', () => {
    expect(dateFromParts('31', '4', '2026')).toBeNull();
    expect(dateFromParts('29', '2', '2026')).toBeNull();
    expect(dateFromParts('', '1', '2026')).toBeNull();
    expect(dateFromParts('1', '13', '2026')).toBeNull();
    expect(dateFromParts('1', '1', '26')).toBeNull();
  });

  it('moves by whole months across years', () => {
    expect(addMonths('2026-11-01', 3)).toBe('2027-02-01');
    expect(addMonths('2026-01-01', 12)).toBe('2027-01-01');
  });
});

describe('Accounting period', () => {
  const monthly: PeriodSetting = { every: 1, yearStarts: 1 };
  const quarterlyFromMarch: PeriodSetting = { every: 3, yearStarts: 3 };
  const yearlyFromJuly: PeriodSetting = { every: 12, yearStarts: 7 };

  it('finds the month a date falls in', () => {
    expect(periodContaining('2026-11-27', monthly)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodContaining('2028-02-10', monthly)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('counts every 3 months from the month the year starts', () => {
    expect(periodContaining('2026-11-27', quarterlyFromMarch)).toEqual({ start: '2026-09-01', end: '2026-11-30' });
    expect(periodContaining('2027-02-01', quarterlyFromMarch)).toEqual({ start: '2026-12-01', end: '2027-02-28' });
  });

  it('runs a year from the month it starts, across the calendar year', () => {
    expect(periodContaining('2026-11-27', yearlyFromJuly)).toEqual({ start: '2026-07-01', end: '2027-06-30' });
    expect(periodContaining('2026-06-30', yearlyFromJuly)).toEqual({ start: '2025-07-01', end: '2026-06-30' });
  });

  it('starts the next period the day after this one ends', () => {
    expect(nextPeriodStart('2026-11-27', monthly)).toBe('2026-12-01');
    expect(nextPeriodStart('2026-12-31', monthly)).toBe('2027-01-01');
    expect(nextPeriodStart('2026-11-27', yearlyFromJuly)).toBe('2027-07-01');
  });

  it('is described in plain words', () => {
    expect(periodLabel(monthly)).toBe('Every month, year starts in January');
    expect(periodLabel(quarterlyFromMarch)).toBe('Every 3 months, year starts in March');
  });
});
