import { describe, it } from 'vitest';
import { coreEvents } from '../core/harness/events';
import { runSequences } from '../core/harness/harness';
import { invoiceFromLines } from '../documents/harness';
import { depositOnQuotation, paymentFromScreen } from './harness';

describe('random sequences with Payments recorded on the Payment screen', () => {
  it('keep the seven rules and a balanced ledger after every step', () => {
    runSequences({ events: [...coreEvents, invoiceFromLines, paymentFromScreen, paymentFromScreen], numRuns: 300, maxSteps: 40 });
  }, 60_000);
});

describe('random sequences with Deposits on Quotations', () => {
  it('keep the seven rules and a balanced ledger after every step', () => {
    runSequences({ events: [...coreEvents, paymentFromScreen, depositOnQuotation, depositOnQuotation], numRuns: 300, maxSteps: 40 });
  }, 60_000);
});
