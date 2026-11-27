import { describe, it } from 'vitest';
import { coreEvents } from '../core/harness/events';
import { runSequences } from '../core/harness/harness';
import { invoiceFromLines, quotationInvoicedInParts } from './harness';

describe('random sequences with Invoices issued from lines', () => {
  it('keep the seven rules and a balanced ledger after every step', () => {
    runSequences({ events: [...coreEvents, invoiceFromLines, quotationInvoicedInParts], numRuns: 300, maxSteps: 40 });
  });
});
