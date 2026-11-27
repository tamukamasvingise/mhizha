import { describe, expect, it } from 'vitest';
import { help, tutorials } from './help';

describe('Help', () => {
  it('carries the five tutorials, in the order the work happens', () => {
    expect(tutorials.map((t) => t.title)).toEqual([
      'Make a Quotation',
      'Turn a Quotation into an Invoice',
      'Record a payment',
      'Make a Backup',
      'Restore from a Backup',
    ]);
    for (const t of tutorials) expect(t.steps.length).toBeGreaterThan(1);
  });

  it('warns that GitHub issues are public before the User asks for help there', () => {
    const support = help.find((s) => s.id === 'support')!;
    expect(support.steps.join(' ')).toMatch(/issues are public/i);
  });

  it('says what to do if Mhizha ever has to be built under a new key', () => {
    expect(help.some((s) => /new key/i.test([s.title, ...s.steps].join(' ')))).toBe(true);
  });
});
