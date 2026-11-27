// Ticket 09's event for the fast-check harness: a Payment recorded as the
// Payment screen records it. The amount is spread over the ticked Invoices
// oldest first (with some amounts changed by hand); money more than they owe
// is refused for now (Credit is a later ticket). Now and then the money came
// in before the Invoice date: it is then held as Credit and applied on that
// date, in the same save. Separate receipts give one Payment per Invoice.
import { fillOldestFirst, PAYMENT_METHODS, post, postings } from '../core';
import type { HarnessEvent } from '../core/harness/harness';
import {
  entryMeta,
  invoiceBalance,
  Refused,
  replaceById,
  withHeld,
  type InvoiceRecord,
  type PaymentRecord,
  type World,
} from '../core/harness/world';

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

// Ticket 11's event: a Deposit paid on an accepted Quotation, then Invoices
// issued from it in parts. Each issue applies the Deposit up to the Invoice
// total (the User may take less), and the rest waits; what is left at the end
// may be moved to Credit, as when the Quotation is declined or the Job closes.
// A Deposit is never applied beyond what is held on its Quotation or what the
// Invoice owes.
export const depositOnQuotation: HarnessEvent = {
  name: 'Deposit on a Quotation, applied as Invoices are issued from it',
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const quotationTotal = pick.int(1, 200_000);
    const deposit = pick.chance(10) ? quotationTotal + pick.int(1, 1_000) : pick.int(1, quotationTotal);
    const method = pick.oneOf(PAYMENT_METHODS);
    const parts = Array.from({ length: pick.int(0, 3) }, () => ({ total: pick.int(1, quotationTotal), less: pick.chance(20) }));
    const toCredit = pick.chance(40);
    return {
      describe: `Deposit of ${deposit} on a Quotation of ${quotationTotal} for ${customerId}, Invoices ${JSON.stringify(parts)}${toCredit ? ', the rest moved to Credit' : ''}`,
      run: (w) => {
        // The app offers at most what the Quotation has not yet invoiced or held.
        if (deposit > quotationTotal) throw new Refused('a Deposit above the Quotation total');
        const payId = `pay${w.payments.length + 1}`;
        const meta = entryMeta(w, 'receipt', payId);
        let journal = post(w.journal, { ...meta, lines: postings.payment({ customerId, method, toDeposits: deposit }) });
        let invoices = w.invoices;
        let held = deposit;
        let world: World = w;
        for (const part of parts) {
          const id = `inv${invoices.length + 1}`;
          const invoiceMeta = entryMeta({ ...world, journal }, 'invoice', id);
          journal = post(journal, { ...invoiceMeta, lines: postings.invoiceIssued({ customerId, total: part.total }) });
          const most = Math.min(held, part.total);
          const apply = part.less ? Math.floor(most / 2) : most;
          if (apply > held || apply > part.total) throw new Error(`applied ${apply} with ${held} held on an Invoice of ${part.total}`);
          if (apply > 0)
            journal = post(journal, {
              ...entryMeta({ ...world, journal }, 'receipt', `applied-${id}`),
              lines: postings.applied({ customerId, from: 'deposit', amount: apply }),
            });
          held -= apply;
          const record: InvoiceRecord = {
            id, kind: 'invoice', customerId, total: part.total, applied: apply, writtenOff: 0, active: true, entryId: invoiceMeta.id,
          };
          invoices = [...invoices, record];
          world = { ...world, journal, invoices };
        }
        const h = w.held[customerId]!;
        let deposits = h.deposits + held;
        let credit = h.credit;
        if (toCredit && held > 0) {
          journal = post(journal, {
            ...entryMeta({ ...world, journal }, 'quotation', payId),
            lines: postings.depositToCredit({ customerId, amount: held }),
          });
          deposits -= held;
          credit += held;
        }
        const payment: PaymentRecord = {
          id: payId, customerId, amount: deposit, toInvoices: [], toDeposits: deposit, toCredit: 0, active: true, entryId: meta.id,
        };
        return {
          ...w,
          journal,
          invoices,
          payments: [...w.payments, payment],
          held: withHeld(w, customerId, { deposits, credit }),
        };
      },
    };
  },
};
