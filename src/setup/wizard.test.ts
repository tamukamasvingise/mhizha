import { describe, expect, it } from 'vitest';
import { emptyBusiness } from './store';
import { stepProblems, wizardSteps } from './wizard';

describe('the setup wizard', () => {
  it('asks for business details, then Document numbers, Start date, Accounting period, Opening balances, sales before the Start date and App lock', () => {
    expect(wizardSteps(true).map((s) => s.id)).toEqual([
      'business',
      'contact',
      'look',
      'payment',
      'signature',
      'numbers',
      'start',
      'period',
      'opening',
      'presales',
      'lock',
    ]);
  });

  it('asks about the App lock only if the phone has a screen lock', () => {
    expect(wizardSteps(false).map((s) => s.id)).not.toContain('lock');
  });

  it('asks one plain question on each step', () => {
    for (const s of wizardSteps(true)) expect(s.question).toMatch(/\?$/);
  });
});

describe('checking a step before moving on', () => {
  const blank = emptyBusiness();

  it('stops on the first step until the business has a name', () => {
    expect(stepProblems('business', blank)).toEqual({ name: 'Enter the name of your business.' });
    expect(stepProblems('business', { ...blank, name: 'Demo Building Services' })).toEqual({});
  });

  it('checks the email on the contact step only', () => {
    const d = { ...blank, email: 'not an email' };
    expect(stepProblems('contact', d)).toHaveProperty('email');
    expect(stepProblems('business', { ...d, name: 'Demo' })).toEqual({});
  });

  it('checks an own brand colour on the look step', () => {
    expect(stepProblems('look', { ...blank, brandColour: 'orange-ish' })).toHaveProperty('brandColour');
  });

  it('lets the later steps through: they check their own fields', () => {
    expect(stepProblems('numbers', blank)).toEqual({});
  });
});
