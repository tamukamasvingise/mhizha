import { PAYMENT_METHODS } from "../accounts";
import { post, reverse } from "../ledger";
import { postings } from "../postings";
import type { HarnessEvent, Pick } from "./harness";
import {
  entryMeta,
  invoiceBalance,
  Refused,
  replaceById,
  withHeld,
  type InvoiceRecord,
  type World,
} from "./world";

/** Usually a valid amount up to `max`; now and then one too many, to prove it is refused. */
function amountUpTo(pick: Pick, max: number): number {
  return pick.chance(10) ? max + pick.int(1, 500) : pick.int(1, Math.max(1, max));
}

function openInvoices(world: World, customerId: string): InvoiceRecord[] {
  return world.invoices.filter((i) => i.customerId === customerId && invoiceBalance(i) > 0);
}

function correction(world: World) {
  const { id, accountingDate, recordedAt } = entryMeta(world, "", "");
  return { id, accountingDate, recordedAt };
}

function takeHeld(world: World, customerId: string, from: "deposit" | "credit", amount: number) {
  const h = world.held[customerId]!;
  return withHeld(world, customerId, from === "deposit" ? { deposits: h.deposits - amount } : { credit: h.credit - amount });
}

const issueInvoice: HarnessEvent = {
  name: "Invoice issued",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const total = pick.int(1, 200_000);
    return {
      describe: `issue Invoice of ${total} to ${customerId}`,
      run: (w) => {
        const id = `inv${w.invoices.length + 1}`;
        const meta = entryMeta(w, "invoice", id);
        const journal = post(w.journal, { ...meta, lines: postings.invoiceIssued({ customerId, total }) });
        const record: InvoiceRecord = {
          id, kind: "invoice", customerId, total, applied: 0, writtenOff: 0, active: true, entryId: meta.id,
        };
        return { ...w, journal, invoices: [...w.invoices, record] };
      },
    };
  },
};

const openingOwed: HarnessEvent = {
  name: "Opening balance owed",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const amount = pick.int(1, 100_000);
    return {
      describe: `Opening balance of ${amount} owed by ${customerId}`,
      run: (w) => {
        const id = `ob${w.invoices.length + 1}`;
        const meta = entryMeta(w, "opening-balance", id);
        const journal = post(w.journal, { ...meta, lines: postings.openingOwed({ customerId, amount }) });
        const record: InvoiceRecord = {
          id, kind: "opening", customerId, total: amount, applied: 0, writtenOff: 0, active: true, entryId: meta.id,
        };
        return { ...w, journal, invoices: [...w.invoices, record] };
      },
    };
  },
};

const openingCredit: HarnessEvent = {
  name: "Opening balance of Credit held",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const amount = pick.int(1, 50_000);
    return {
      describe: `Opening balance of ${amount} Credit held for ${customerId}`,
      run: (w) => ({
        ...w,
        journal: post(w.journal, {
          ...entryMeta(w, "opening-balance", `obc${w.journal.length + 1}`),
          lines: postings.openingCredit({ customerId, amount }),
        }),
        held: withHeld(w, customerId, { credit: w.held[customerId]!.credit + amount }),
        openingCredit: w.openingCredit + amount,
      }),
    };
  },
};

const receivePayment: HarnessEvent = {
  name: "Payment received",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const method = pick.oneOf(PAYMENT_METHODS);
    const toInvoices = openInvoices(world, customerId)
      .filter(() => pick.chance(60))
      .map((i) => ({ invoiceId: i.id, amount: amountUpTo(pick, invoiceBalance(i)) }));
    const toDeposits = pick.chance(30) ? pick.int(1, 50_000) : 0;
    const toCredit = pick.chance(20) ? pick.int(1, 20_000) : 0;
    const toInvoicesTotal = toInvoices.reduce((s, t) => s + t.amount, 0);
    const amount = toInvoicesTotal + toDeposits + toCredit;
    return {
      describe: `Payment of ${amount} by ${method} from ${customerId}: ${JSON.stringify({ toInvoices, toDeposits, toCredit })}`,
      run: (w) => {
        let invoices = w.invoices;
        for (const part of toInvoices) {
          const invoice = invoices.find((i) => i.id === part.invoiceId)!;
          if (part.amount > invoiceBalance(invoice)) throw new Refused(`more than ${invoice.id} owes`);
          invoices = replaceById(invoices, invoice.id, { applied: invoice.applied + part.amount });
        }
        const id = `pay${w.payments.length + 1}`;
        const meta = entryMeta(w, "payment", id);
        const journal = post(w.journal, {
          ...meta,
          lines: postings.payment({ customerId, method, toInvoices: toInvoicesTotal, toDeposits, toCredit }),
        });
        const held = w.held[customerId]!;
        return {
          ...w,
          journal,
          invoices,
          payments: [
            ...w.payments,
            { id, customerId, amount, toInvoices, toDeposits, toCredit, active: true, entryId: meta.id },
          ],
          held: withHeld(w, customerId, { deposits: held.deposits + toDeposits, credit: held.credit + toCredit }),
        };
      },
    };
  },
};

const applyHeld: HarnessEvent = {
  name: "Deposit or Credit applied",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const open = openInvoices(world, customerId);
    if (!open.length) return null;
    const invoice = pick.oneOf(open);
    const from = pick.oneOf(["deposit", "credit"] as const);
    const held = from === "deposit" ? world.held[customerId]!.deposits : world.held[customerId]!.credit;
    if (held === 0 && !pick.chance(20)) return null;
    const amount = amountUpTo(pick, Math.min(held, invoiceBalance(invoice)));
    return {
      describe: `apply ${amount} of ${from} to ${invoice.id}`,
      run: (w) => {
        const current = w.invoices.find((i) => i.id === invoice.id)!;
        if (amount > invoiceBalance(current)) throw new Refused(`more than ${current.id} owes`);
        // The ledger refuses it if more is applied than is held.
        const journal = post(w.journal, {
          ...entryMeta(w, "applied", invoice.id),
          lines: postings.applied({ customerId, from, amount }),
        });
        return {
          ...w,
          journal,
          invoices: replaceById(w.invoices, current.id, { applied: current.applied + amount }),
          held: takeHeld(w, customerId, from, amount),
        };
      },
    };
  },
};

const depositToCredit: HarnessEvent = {
  name: "Deposit moved to Credit",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const deposits = world.held[customerId]!.deposits;
    if (deposits === 0 && !pick.chance(20)) return null;
    const amount = amountUpTo(pick, deposits);
    return {
      describe: `move ${amount} of Deposit to Credit for ${customerId}`,
      run: (w) => {
        const journal = post(w.journal, {
          ...entryMeta(w, "deposit-to-credit", customerId),
          lines: postings.depositToCredit({ customerId, amount }),
        });
        const h = w.held[customerId]!;
        return { ...w, journal, held: withHeld(w, customerId, { deposits: h.deposits - amount, credit: h.credit + amount }) };
      },
    };
  },
};

const refund: HarnessEvent = {
  name: "Refund",
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const from = pick.oneOf(["deposit", "credit"] as const);
    const method = pick.oneOf(PAYMENT_METHODS);
    const held = from === "deposit" ? world.held[customerId]!.deposits : world.held[customerId]!.credit;
    if (held === 0 && !pick.chance(20)) return null;
    const amount = amountUpTo(pick, held);
    return {
      describe: `refund ${amount} of ${from} to ${customerId} by ${method}`,
      run: (w) => {
        const id = `ref${w.refunds.length + 1}`;
        const meta = entryMeta(w, "refund", id);
        const journal = post(w.journal, { ...meta, lines: postings.refund({ customerId, from, method, amount }) });
        return {
          ...w,
          journal,
          refunds: [...w.refunds, { id, customerId, from, amount, active: true, entryId: meta.id }],
          held: takeHeld(w, customerId, from, amount),
        };
      },
    };
  },
};

const writeOff: HarnessEvent = {
  name: "Write-off",
  plan: (world, pick) => {
    const open = world.invoices.filter((i) => invoiceBalance(i) > 0);
    if (!open.length) return null;
    const invoice = pick.oneOf(open);
    return {
      describe: `write off the remainder of ${invoice.id}`,
      run: (w) => {
        const current = w.invoices.find((i) => i.id === invoice.id)!;
        const amount = invoiceBalance(current);
        const id = `wo${w.writeOffs.length + 1}`;
        const meta = entryMeta(w, "write-off", id);
        const journal = post(w.journal, { ...meta, lines: postings.writeOff({ customerId: current.customerId, amount }) });
        return {
          ...w,
          journal,
          invoices: replaceById(w.invoices, current.id, { writtenOff: current.writtenOff + amount }),
          writeOffs: [...w.writeOffs, { id, invoiceId: current.id, amount, active: true, entryId: meta.id }],
        };
      },
    };
  },
};

const undoWriteOff: HarnessEvent = {
  name: "Write-off undone",
  plan: (world, pick) => {
    const active = world.writeOffs.filter((x) => x.active);
    if (!active.length) return null;
    const wo = pick.oneOf(active);
    return {
      describe: `undo ${wo.id}`,
      run: (w) => {
        const invoice = w.invoices.find((i) => i.id === wo.invoiceId)!;
        return {
          ...w,
          journal: reverse(w.journal, wo.entryId, correction(w)),
          invoices: replaceById(w.invoices, invoice.id, { writtenOff: invoice.writtenOff - wo.amount }),
          writeOffs: replaceById(w.writeOffs, wo.id, { active: false }),
        };
      },
    };
  },
};

const cancelPayment: HarnessEvent = {
  name: "Payment cancelled",
  plan: (world, pick) => {
    const active = world.payments.filter((p) => p.active);
    if (!active.length) return null;
    const payment = pick.oneOf(active);
    return {
      describe: `cancel ${payment.id}`,
      run: (w) => {
        let invoices = w.invoices;
        for (const part of payment.toInvoices) {
          const invoice = invoices.find((i) => i.id === part.invoiceId)!;
          if (w.writeOffs.some((x) => x.active && x.invoiceId === invoice.id)) {
            throw new Refused(`undo the Write-off on ${invoice.id} first`);
          }
          invoices = replaceById(invoices, invoice.id, { applied: invoice.applied - part.amount });
        }
        const h = w.held[payment.customerId]!;
        return {
          ...w,
          // The ledger refuses this if the Deposit or Credit it brought in has been used or refunded.
          // Later entries of the same save are reversed first, newest first.
          journal: [...(payment.laterEntryIds ?? []).slice().reverse(), payment.entryId].reduce(
            (j, entryId) => reverse(j, entryId, correction({ ...w, journal: j })),
            w.journal,
          ),
          invoices,
          payments: replaceById(w.payments, payment.id, { active: false }),
          held: withHeld(w, payment.customerId, {
            deposits: h.deposits - payment.toDeposits,
            credit: h.credit - payment.toCredit,
          }),
        };
      },
    };
  },
};

const cancelUnpaidInvoice: HarnessEvent = {
  name: "Unpaid Invoice cancelled",
  plan: (world, pick) => {
    const active = world.invoices.filter((i) => i.active);
    if (!active.length) return null;
    const invoice = pick.oneOf(active);
    return {
      describe: `cancel ${invoice.id}`,
      run: (w) => {
        const current = w.invoices.find((i) => i.id === invoice.id)!;
        // Cancelling with money applied returns it to Deposit or Credit: added by the cancel ticket.
        if (current.applied > 0 || current.writtenOff > 0) throw new Refused(`${current.id} has money applied`);
        return {
          ...w,
          journal: reverse(w.journal, current.entryId, correction(w)),
          invoices: replaceById(w.invoices, current.id, { active: false }),
        };
      },
    };
  },
};

const daysPass: HarnessEvent = {
  name: "Days pass",
  plan: (_, pick) => {
    const days = pick.int(1, 40);
    return { describe: `${days} days pass`, run: (w) => ({ ...w, day: w.day + days }) };
  },
};

/** The events this ticket provides. Later tickets run `[...coreEvents, ...theirs]`. */
export const coreEvents: readonly HarnessEvent[] = [
  issueInvoice,
  openingOwed,
  openingCredit,
  receivePayment,
  applyHeld,
  depositToCredit,
  refund,
  writeOff,
  undoWriteOff,
  cancelPayment,
  cancelUnpaidInvoice,
  daysPass,
];
