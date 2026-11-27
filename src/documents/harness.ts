// Ticket 07's event for the fast-check harness: an Invoice issued from typed
// lines and one Discount, as the app issues it. Zero-price lines, oversized
// Discounts and Totals of zero must be refused and leave the world untouched.
import { issuableTotals, post, postings, type Discount } from '../core';
import type { HarnessEvent } from '../core/harness/harness';
import { entryMeta, type InvoiceRecord } from '../core/harness/world';

export const invoiceFromLines: HarnessEvent = {
  name: 'Invoice issued from lines with a Discount',
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const lines = Array.from({ length: pick.int(0, 4) }, () => ({
      quantity: pick.int(1, 20_000),
      unitPrice: pick.chance(20) ? 0 : pick.int(1, 50_000),
    }));
    const discount: Discount | undefined = pick.chance(40)
      ? pick.chance(50)
        ? { kind: 'amount', cents: pick.int(0, 100_000) }
        : { kind: 'percent', tenths: pick.int(0, 999) }
      : undefined;
    return {
      describe: `issue Invoice to ${customerId} from ${JSON.stringify(lines)} with ${JSON.stringify(discount ?? null)}`,
      run: (w) => {
        const { total } = issuableTotals({ lines, discount });
        const id = `inv${w.invoices.length + 1}`;
        const meta = entryMeta(w, 'invoice', id);
        const journal = post(w.journal, { ...meta, lines: postings.invoiceIssued({ customerId, total }) });
        const record: InvoiceRecord = {
          id, kind: 'invoice', customerId, total, applied: 0, writtenOff: 0, active: true, entryId: meta.id,
        };
        return { ...w, journal, invoices: [...w.invoices, record] };
      },
    };
  },
};
