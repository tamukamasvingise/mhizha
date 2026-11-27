import { describe, expect, it } from 'vitest';
import { dateOf, longDate, plainDate, shortDate } from './dates';

describe('plain dates', () => {
  it('is the day on the phone, not in UTC', () => {
    expect(plainDate(new Date(2026, 10, 27, 23, 30))).toBe('2026-11-27');
    expect(plainDate(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });

  it('turns back into a local Date for the date picker', () => {
    const d = dateOf('2026-11-27');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 27]);
  });

  it('is shown as 26 Nov 2026, or 26 November 2026 in full', () => {
    expect(shortDate('2026-11-26')).toBe('26 Nov 2026');
    expect(longDate('2026-09-01')).toBe('1 September 2026');
  });
});
