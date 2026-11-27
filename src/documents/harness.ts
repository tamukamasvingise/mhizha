// Ticket 07's event for the fast-check harness: an Invoice issued from typed
// lines and one Discount, as the app issues it. Zero-price lines, oversized
// Discounts and Totals of zero must be refused and leave the world untouched.
import { discountShare, documentTotals, issuableTotals, post, postings, type Discount } from '../core';
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

// Ticket 10's event: a Quotation (which posts nothing) invoiced in parts.
// Each Invoice takes its share of the Quotation's Discount the app's way, and
// the User may take less; the shares never add up to more than the Discount,
// and when the parts cover the Quotation and nobody changed a share, they add
// up to all of it.
export const quotationInvoicedInParts: HarnessEvent = {
  name: 'Quotation issued, then invoiced in parts with Discount shares',
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const lines = Array.from({ length: pick.int(1, 5) }, () => ({ quantity: pick.int(1, 20_000), unitPrice: pick.int(0, 50_000) }));
    const discount: Discount | undefined = pick.chance(60)
      ? pick.chance(50)
        ? { kind: 'amount', cents: pick.int(0, 100_000) }
        : { kind: 'percent', tenths: pick.int(0, 999) }
      : undefined;
    // Which Invoice each line goes on; now and then a line is left out.
    const parts = pick.int(1, 3);
    const onInvoice = lines.map(() => (pick.chance(10) ? -1 : pick.int(0, parts - 1)));
    const takeLess = Array.from({ length: parts }, () => pick.chance(15));
    return {
      describe: `Quotation to ${customerId} of ${JSON.stringify(lines)} with ${JSON.stringify(discount ?? null)}, invoiced as ${JSON.stringify(onInvoice)}${takeLess.some(Boolean) ? ', some shares taken smaller' : ''}`,
      run: (w) => {
        // Issuing the Quotation posts nothing: nothing is owed until it is invoiced.
        const q = issuableTotals({ lines, discount });
        let world = w;
        let subtotalBefore = 0;
        let alreadyTaken = 0;
        for (let i = 0; i < parts; i++) {
          const mine = lines.filter((_, k) => onInvoice[k] === i);
          if (mine.length === 0) continue;
          const subtotal = documentTotals({ lines: mine }).subtotal;
          let share = discountShare({
            discount: q.discount,
            quotationSubtotal: q.subtotal,
            invoiceSubtotal: subtotal,
            subtotalBefore,
            alreadyTaken,
            // As the app decides it: the Invoice that reaches the Quotation's Subtotal is the last.
            last: subtotalBefore + subtotal >= q.subtotal,
          });
          if (takeLess[i]) share = Math.floor(share / 2);
          if (share > subtotal) throw new Error(`a share of ${share} is more than the Invoice Subtotal ${subtotal}`);
          const { total } = issuableTotals({ lines: mine, discount: { kind: 'amount', cents: share } });
          alreadyTaken += share;
          subtotalBefore += subtotal;
          if (alreadyTaken > q.discount) throw new Error(`the shares come to ${alreadyTaken}, more than the Discount of ${q.discount}`);
          const id = `inv${world.invoices.length + 1}`;
          const meta = entryMeta(world, 'invoice', id);
          const journal = post(world.journal, { ...meta, lines: postings.invoiceIssued({ customerId, total }) });
          const record: InvoiceRecord = { id, kind: 'invoice', customerId, total, applied: 0, writtenOff: 0, active: true, entryId: meta.id };
          world = { ...world, journal, invoices: [...world.invoices, record] };
        }
        const covered = !onInvoice.includes(-1) && !takeLess.some(Boolean);
        if (covered && alreadyTaken !== q.discount)
          throw new Error(`every line was invoiced but the shares come to ${alreadyTaken}, not the Discount of ${q.discount}`);
        return world;
      },
    };
  },
};
