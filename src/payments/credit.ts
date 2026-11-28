// Credit (spec sections 6 and 9): money the Business holds for a Customer
// that is not a Deposit on a Quotation. It comes in as the part of a Payment
// above what it pays (after the User confirms it), as a Deposit moved to
// Credit, or as an Opening balance of Credit held on the Start date. Plain
// TypeScript over the records.
//
// Each piece of Credit is a "lot": an allocation to the Customer's Credit
// from a Payment (an overpayment) or from a Deposit lot (a Deposit moved); or
// an Opening balance item of Credit not Cancelled. Using it is an allocation
// from that lot (from_kind 'credit', or 'opening-credit' with from_id the
// item): to an Invoice when applied, to a Refund when paid back. What is left of a lot is its
// amount less its live uses, so every use names the Receipt the money came in on.
import { postings, type Cents, type PaymentMethod } from '../core';
import type { Db } from '../db';
import { postEntry } from '../ledger';
import { todayAt } from '../setup/dates';
import { appliedTo } from './allocations';
import { LIVE } from './deposits';
import { issueReceipt } from './receipts';

export type CreditLot = {
  /** The allocation that brought the Credit in, or the Opening balance item. */
  id: string;
  /** Where its uses come from: an allocation lot ('credit') or an Opening balance item ('opening-credit'). */
  useKind: 'credit' | 'opening-credit';
  /** The money Receipt the money came in on; null for Credit from an Opening balance. */
  receiptNumber: string | null;
  /** The day the money came in: its Date received, or the Start date. */
  dateReceived: string;
  /** The day it became Credit (a Deposit becomes Credit when it is moved). */
  heldFrom: string;
  /** How the money was paid, when it came in on a Payment. */
  method: PaymentMethod | null;
  amount: Cents;
  left: Cents;
};

/** The Credit a Customer has had, oldest first (the Start date first), with what is left of each. */
export function creditLots(db: Db, customerId: string): CreditLot[] {
  return [...openingLots(db, customerId), ...moneyLots(db, customerId)];
}

const hasOpening = (db: Db) => db.get("SELECT 1 AS x FROM sqlite_schema WHERE type = 'table' AND name = 'opening_balance_item'") !== undefined;

/** Opening balance items of Credit, not Cancelled, dated at the Start date. */
function openingLots(db: Db, customerId: string): CreditLot[] {
  if (!hasOpening(db)) return [];
  return db
    .all(
      `SELECT o.id, o.amount,
         (SELECT e.accounting_date FROM journal_entry e WHERE e.source_kind = 'opening-balance' AND e.source_id = o.id
           AND e.reverses_id IS NULL ORDER BY e.rowid LIMIT 1) AS dated,
         (SELECT coalesce(sum(u.amount), 0) FROM allocation u WHERE u.from_kind = 'opening-credit' AND u.from_id = o.id AND ${LIVE('u')}) AS used
       FROM opening_balance_item o
       WHERE o.customer_id = ? AND o.kind = 'credit' AND o.cancelled_on IS NULL
       ORDER BY o.rowid`,
      [customerId],
    )
    .map((r) => ({
      id: String(r.id),
      useKind: 'opening-credit' as const,
      receiptNumber: null,
      dateReceived: String(r.dated),
      heldFrom: String(r.dated),
      method: null,
      amount: Number(r.amount),
      left: Number(r.amount) - Number(r.used),
    }));
}

function moneyLots(db: Db, customerId: string): CreditLot[] {
  return db
    .all(
      `SELECT a.id, a.amount, e.accounting_date, d.printed_number,
         coalesce(p.method_code, lp.method_code) AS method,
         coalesce(p.date_received, lp.date_received, le.accounting_date) AS received,
         (SELECT coalesce(sum(u.amount), 0) FROM allocation u WHERE u.from_kind = 'credit' AND u.from_id = a.id AND ${LIVE('u')}) AS used
       FROM allocation a JOIN journal_entry e ON e.id = a.journal_entry_id
         LEFT JOIN payment p ON a.from_kind = 'payment' AND p.id = a.from_id
         LEFT JOIN allocation lot ON a.from_kind = 'deposit' AND lot.id = a.from_id
         LEFT JOIN journal_entry le ON le.id = lot.journal_entry_id
         LEFT JOIN payment lp ON lot.from_kind = 'payment' AND lp.id = lot.from_id
         LEFT JOIN document d ON d.id = coalesce(p.receipt_id, lp.receipt_id)
       WHERE a.to_kind = 'credit' AND a.to_id = ? AND a.from_kind IN ('payment', 'deposit') AND ${LIVE('a')}
       ORDER BY e.accounting_date, a.rowid`,
      [customerId],
    )
    .map((r) => ({
      id: String(r.id),
      useKind: 'credit' as const,
      receiptNumber: r.printed_number == null ? null : String(r.printed_number),
      dateReceived: String(r.received),
      heldFrom: String(r.accounting_date),
      method: r.method == null ? null : (String(r.method) as PaymentMethod),
      amount: Number(r.amount),
      left: Number(r.amount) - Number(r.used),
    }));
}

/** The unused Credit held for a Customer. */
export function creditHeld(db: Db, customerId: string): Cents {
  return creditLots(db, customerId).reduce((s, l) => s + l.left, 0);
}

/** The lots `amount` would take, oldest first, and how much of each. */
export function creditTaken(db: Db, customerId: string, amount: Cents): { lot: CreditLot; take: Cents }[] {
  let rest = amount;
  const out: { lot: CreditLot; take: Cents }[] = [];
  for (const lot of creditLots(db, customerId)) {
    if (rest === 0) break;
    const take = Math.min(lot.left, rest);
    if (take <= 0) continue;
    out.push({ lot, take });
    rest -= take;
  }
  if (rest > 0) throw new Error(`Customer ${customerId} holds less Credit than is used`);
  return out;
}

/** Takes `amount` of a Customer's Credit oldest first: one allocation per lot used. */
export function useCredit(
  db: Db,
  customerId: string,
  amount: Cents,
  to: { kind: 'invoice' | 'refund'; id: string; entryId: string },
) {
  for (const { lot, take } of creditTaken(db, customerId, amount)) {
    db.insert('allocation', {
      journal_entry_id: to.entryId,
      from_kind: lot.useKind,
      from_id: lot.id,
      to_kind: to.kind,
      to_id: to.id,
      amount: take,
    });
  }
}

/**
 * Applies `amount` of the Customer's Credit to an Issued Invoice, dated today:
 * a "Credit applied" Receipt (no new money), its line, the allocations and the
 * entry Credit held / Customers owe. Call inside a save. Returns the Receipt id.
 */
export function applyCredit(db: Db, a: { invoiceId: string; amount: Cents; at: number }): string {
  const inv = db.get('SELECT * FROM document WHERE id = ?', [a.invoiceId])!;
  const customerId = String(inv.customer_id);
  const jobTitle = (JSON.parse(String(inv.frozen)) as { job: { title: string } }).job.title;
  const receipt = issueReceipt(db, {
    customerId,
    jobIds: [String(inv.job_id)],
    jobTitles: [jobTitle],
    amount: a.amount,
    at: a.at,
  });
  const entryId = postEntry(db, {
    accountingDate: todayAt(a.at),
    recordedAt: new Date(a.at).toISOString(),
    source: { kind: 'receipt', id: receipt.id },
    lines: postings.applied({ customerId, from: 'credit', amount: a.amount }),
  });
  useCredit(db, customerId, a.amount, { kind: 'invoice', id: a.invoiceId, entryId });
  db.insert('receipt_line', {
    receipt_id: receipt.id,
    position: 1,
    invoice_id: a.invoiceId,
    job_id: String(inv.job_id),
    applied_to: String(inv.printed_number),
    job_title: jobTitle,
    total: Number(inv.total),
    amount: a.amount,
    balance_left: Number(inv.total) - appliedTo(db, a.invoiceId),
  });
  return receipt.id;
}

/** Whether a Receipt with no Payment applied Credit (rather than a Deposit). */
export function appliesCredit(db: Db, receiptId: string): boolean {
  return (
    db.get(
      `SELECT 1 AS x FROM allocation a JOIN journal_entry e ON e.id = a.journal_entry_id
       WHERE (a.from_kind = 'credit' OR (a.from_kind = 'opening-credit' AND a.to_kind = 'invoice'))
         AND e.source_kind = 'receipt' AND e.source_id = ? LIMIT 1`,
      [receiptId],
    ) !== undefined
  );
}

/** Where the Credit a Document used came from, oldest first: each money Receipt, or (number null) an Opening balance. */
export function creditFrom(db: Db, documentId: string, toKind: 'invoice' | 'refund'): { number: string | null; dateReceived: string }[] {
  const ids = new Set(
    db
      .all(
        `SELECT a.from_id FROM allocation a JOIN journal_entry e ON e.id = a.journal_entry_id
         WHERE a.from_kind IN ('credit', 'opening-credit') AND a.to_kind = ? AND e.source_id = ?`,
        [toKind, documentId],
      )
      .map((r) => String(r.from_id)),
  );
  const customer = db.get('SELECT customer_id FROM document WHERE id = ?', [documentId]);
  if (!customer) return [];
  const seen = new Set<string>();
  return creditLots(db, String(customer.customer_id))
    .filter((l) => ids.has(l.id))
    .map((l) => ({ number: l.receiptNumber, dateReceived: l.dateReceived }))
    .filter((x) => {
      const k = `${x.number}|${x.dateReceived}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
