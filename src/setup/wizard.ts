// The steps of the setup wizard, in order, each with its one question. The
// Opening balances and sales-before-the-Start-date steps (spec section 4) are
// added by the Opening balances ticket, between the Accounting period and the
// App lock.
import { problemsWith, type BusinessDetails, type BusinessProblems } from './store';

export type StepId = 'business' | 'contact' | 'look' | 'payment' | 'signature' | 'numbers' | 'start' | 'period' | 'lock';
export type WizardStep = { id: StepId; question: string };

const ALL: readonly WizardStep[] = [
  { id: 'business', question: 'What is your business called?' },
  { id: 'contact', question: 'How do customers reach you?' },
  { id: 'look', question: 'How should your Documents look?' },
  { id: 'payment', question: 'How do customers pay you?' },
  { id: 'signature', question: 'Do you want to sign your Documents?' },
  { id: 'numbers', question: 'Where should your Document numbers start?' },
  { id: 'start', question: 'When do your records in Mhizha start?' },
  { id: 'period', question: 'How often do you want to review your records?' },
  { id: 'lock', question: "Lock Mhizha with your phone's lock?" },
];

/** The steps for this phone. The App lock is asked only if the phone has a screen lock. */
export function wizardSteps(phoneHasLock: boolean): WizardStep[] {
  return ALL.filter((s) => s.id !== 'lock' || phoneHasLock);
}

/** Which Business details fields each step asks for. */
const FIELDS: Partial<Record<StepId, readonly (keyof BusinessProblems)[]>> = {
  business: ['name'],
  contact: ['email'],
  look: ['brandColour'],
};

/** What must be fixed on this step before moving on. Empty when none. */
export function stepProblems(id: StepId, d: BusinessDetails): BusinessProblems {
  const all = problemsWith(d);
  const out: BusinessProblems = {};
  for (const f of FIELDS[id] ?? []) if (all[f]) out[f] = all[f];
  return out;
}
