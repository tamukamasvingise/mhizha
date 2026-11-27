// Ticket 09's event for the fast-check harness: a Payment recorded as the
// Payment screen records it. The amount is spread over the ticked Invoices
// oldest first (with some amounts changed by hand); money more than they owe
// is refused for now (Credit is a later ticket). Now and then the money came
// in before the Invoice date: it is then held as Credit and applied on that
// date, in the same save. Separate receipts give one Payment per Invoice.
import { fillOldestFirst, PAYMENT_METHODS, post, postings } from '../core';
import type { HarnessEvent } from '../core/harness/harness';
import { entryMeta, invoiceBalance, Refused, replaceById, type PaymentRecord, type World } from '../core/harness/world';

export const paymentFromScreen: HarnessEvent = {
  name: 'Payment recorded on the Payment screen',
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const open = world.invoices.filter((i) => i.customerId === customerId && invoiceBalance(i) > 0);
    const ticked = open.filter(() => pick.chance(70));
    const owed = ticked.reduce((s, i) => s + invoiceBalance(i), 0);
    const amount = pick.chance(10) ? owed + pick.int(1, 5_000) : pick.int(1, Math.max(1, owed));
    const changed = Object.fromEntries(
      ticked.filter(() => pick.chance(20)).map((i) => [i.id, pick.int(0, invoiceBalance(i))]),
    );
    const method = pick.oneOf(PAYMENT_METHODS);
    const separate = pick.chance(30);
    const early = pick.chance(15);
    return {
      describe: `Payment of ${amount} from ${customerId} for ${JSON.stringify(ticked.map((i) => i.id))}, changed ${JSON.stringify(changed)}${separate ? ', separate receipts' : ''}${early ? ', received before the Invoice date' : ''}`,
      run: (w) => {
        const now = w.invoices.filter((i) => ticked.some((t) => t.id === i.id)).map((i) => ({ id: i.id, owed: invoiceBalance(i) }));
        const split = fillOldestFirst(amount, now, changed);
        if (split.parts.length === 0) throw new Refused('no Invoice ticked');
        if (split.left > 0) throw new Refused('more than the ticked Invoices owe');
        const groups = separate ? split.parts.map((p) => [p]) : [split.parts];
        let next: World = w;
        for (const parts of groups) {
          const total = parts.reduce((s, p) => s + p.amount, 0);
          const id = `pay${next.payments.length + 1}`;
          const meta = entryMeta(next, 'receipt', id);
          let journal = post(next.journal, {
            ...meta,
            lines: postings.payment(early ? { customerId, method, toCredit: total } : { customerId, method, toInvoices: total }),
          });
          let invoices = next.invoices;
          const later: string[] = [];
          for (const part of parts) {
            if (early) {
              const applied = entryMeta({ ...next, journal }, 'receipt', id);
              later.push(applied.id);
              journal = post(journal, {
                ...applied,
                lines: postings.applied({ customerId, from: 'credit', amount: part.amount }),
              });
            }
            const invoice = invoices.find((i) => i.id === part.id)!;
            invoices = replaceById(invoices, invoice.id, { applied: invoice.applied + part.amount });
          }
          const record: PaymentRecord = {
            id,
            customerId,
            amount: total,
            toInvoices: parts.map((p) => ({ invoiceId: p.id, amount: p.amount })),
            toDeposits: 0,
            toCredit: 0,
            active: true,
            entryId: meta.id,
            laterEntryIds: later,
          };
          next = { ...next, journal, invoices, payments: [...next.payments, record] };
        }
        return next;
      },
    };
  },
};
