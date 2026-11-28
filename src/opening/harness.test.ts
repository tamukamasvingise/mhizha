import { describe, it } from 'vitest';
import { coreEvents } from '../core/harness/events';
import { runSequences } from '../core/harness/harness';
import { invoiceFromLines } from '../documents/harness';
import { paymentFromScreen } from '../payments/harness';
import { openingEvents } from './harness';

describe('random sequences with Opening balances', () => {
  it('keep the seven rules and a balanced ledger after every step', () => {
    runSequences({
      events: [...coreEvents, invoiceFromLines, paymentFromScreen, ...openingEvents, ...openingEvents],
      numRuns: 300,
      maxSteps: 40,
    });
  }, 60_000);
});
