// Deposits (spec sections 6 and 9): money paid against an accepted Quotation
// and held for the Customer until it is applied to an Invoice from that
// Quotation, moved to Credit, or refunded. Plain TypeScript over the records.
//
// Each Deposit received is one allocation from a Payment to a Quotation (a
// "lot"); Credit held on the Start date made a Quotation's Deposit is a lot
// too (from_kind 'opening-credit', no Receipt). Using it is an allocation from that lot (from_kind 'deposit'):
// to an Invoice when applied, to the Customer's Credit when moved. What is
// left of a lot is its amount less its live uses, so every use names the
// Receipt the money came in on. Deposits stay with the Quotation's number
// through its Revisions.
import { postings, type Cents } from '../core';
import type { Db } from '../db';
import { postEntry } from '../ledger';
import { appliedTo } from './allocations';
import { issueReceipt } from './receipts';

export type DepositLot = {
  /** The allocation that brought the Deposit in. */
  id: string;
  quotationId: string;
  /** The money Receipt it came in on; null for Credit from an Opening balance. */
  receiptNumber: string | null;
  /** The day it came in: the Date received, or the Start date. */
  dateReceived: string;
  amount: Cents;
  left: Cents;
};

/** Not reversed, and not itself a reversal. */
export const LIVE = (a: string) =>
  `${a}.reverses_id IS NULL AND NOT EXISTS (SELECT 1 FROM allocation r WHERE r.reverses_id = ${a}.id)`;

/** Every Issued version of a Quotation: the ids under its number. */
export function quotationFamily(db: Db, quotationId: string): string[] {
  return db
    .all(
      `SELECT id FROM document WHERE type = 'QUO' AND number IS NOT NULL
       AND number = (SELECT number FROM document WHERE id = ? AND type = 'QUO')`,
      [quotationId],
    )
    .map((r) => String(r.id));
}

/** The Deposits received on a Quotation (any of its versions), oldest first, with what is left of each. */
export function depositLots(db: Db, quotationId: string): DepositLot[] {
  const family = quotationFamily(db, quotationId);
  if (family.length === 0) return [];
  return db
    .all(
      `SELECT a.id, a.to_id, a.amount, e.accounting_date, d.printed_number,
         (SELECT coalesce(sum(u.amount), 0) FROM allocation u WHERE u.from_kind = 'deposit' AND u.from_id = a.id AND ${LIVE('u')}) AS used
       FROM allocation a JOIN journal_entry e ON e.id = a.journal_entry_id
         LEFT JOIN payment p ON a.from_kind = 'payment' AND p.id = a.from_id LEFT JOIN document d ON d.id = p.receipt_id
       WHERE a.from_kind IN ('payment', 'opening-credit') AND a.to_kind = 'quotation'
         AND a.to_id IN (${family.map(() => '?').join(', ')}) AND ${LIVE('a')}
       ORDER BY e.accounting_date, a.rowid`,
      family,
    )
    .map((r) => ({
      id: String(r.id),
      quotationId: String(r.to_id),
      receiptNumber: r.printed_number == null ? null : String(r.printed_number),
      dateReceived: String(r.accounting_date),
      amount: Number(r.amount),
      left: Number(r.amount) - Number(r.used),
    }));
}

/** The unused Deposit held on a Quotation. */
export function depositHeld(db: Db, quotationId: string): Cents {
  return depositLots(db, quotationId).reduce((s, l) => s + l.left, 0);
}

/** Takes `amount` from the lots oldest first: one allocation per lot used. */
export function useLots(
  db: Db,
  quotationId: string,
  amount: Cents,
  to: { kind: 'invoice' | 'credit' | 'refund'; id: string; entryId: string },
) {
  let rest = amount;
  for (const lot of depositLots(db, quotationId)) {
    if (rest === 0) break;
    const take = Math.min(lot.left, rest);
    if (take <= 0) continue;
    db.insert('allocation', {
      journal_entry_id: to.entryId,
      from_kind: 'deposit',
      from_id: lot.id,
      to_kind: to.kind,
      to_id: to.id,
      amount: take,
    });
    rest -= take;
  }
  if (rest > 0) throw new Error(`Quotation ${quotationId} holds less Deposit than is used`);
}

/**
 * Applies `amount` of the Deposit on a Quotation to an Invoice just issued
 * from it: a "Deposit applied" Receipt (no new money), its line, the
 * allocations and the entry Deposits held / Customers owe. Call inside the
 * issuing save, after the Invoice has posted. Returns the Receipt id.
 */
export function applyDeposit(
  db: Db,
  a: { quotationId: string; invoiceId: string; amount: Cents; at: number },
): string {
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
    accountingDate: String(inv.issue_date),
    recordedAt: new Date(a.at).toISOString(),
    source: { kind: 'receipt', id: receipt.id },
    lines: postings.applied({ customerId, from: 'deposit', amount: a.amount }),
  });
  useLots(db, a.quotationId, a.amount, { kind: 'invoice', id: a.invoiceId, entryId });
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

/**
 * Moves all the unused Deposit on a Quotation to the Customer's Credit, dated
 * today: Deposits held / Credit held. Call inside the save that needs it.
 * Returns the amount moved; nothing is posted when none is held.
 */
export function moveDepositToCredit(db: Db, quotationId: string, at: number, today: string): Cents {
  const amount = depositHeld(db, quotationId);
  if (amount === 0) return 0;
  const customerId = String(db.get('SELECT customer_id FROM document WHERE id = ?', [quotationId])!.customer_id);
  const entryId = postEntry(db, {
    accountingDate: today,
    recordedAt: new Date(at).toISOString(),
    source: { kind: 'quotation', id: quotationId },
    lines: postings.depositToCredit({ customerId, amount }),
  });
  useLots(db, quotationId, amount, { kind: 'credit', id: customerId, entryId });
  return amount;
}

/**
 * Where a "Deposit applied" Receipt took its money from, oldest first: each
 * money Receipt the Deposit was paid on, or (number null) Credit held from an
 * Opening balance.
 */
export function appliedFrom(db: Db, receiptId: string): { number: string | null; dateReceived: string }[] {
  return db
    .all(
      `SELECT DISTINCT d.printed_number, le.accounting_date, d.number FROM journal_entry e
       JOIN allocation a ON a.journal_entry_id = e.id AND a.from_kind = 'deposit'
       JOIN allocation lot ON lot.id = a.from_id JOIN journal_entry le ON le.id = lot.journal_entry_id
       LEFT JOIN payment p ON lot.from_kind = 'payment' AND p.id = lot.from_id LEFT JOIN document d ON d.id = p.receipt_id
       WHERE e.source_kind = 'receipt' AND e.source_id = ?
       ORDER BY le.accounting_date, d.number`,
      [receiptId],
    )
    .map((r) => ({ number: r.printed_number == null ? null : String(r.printed_number), dateReceived: String(r.accounting_date) }));
}

/**
 * The Deposits and Credit applied to an Invoice, by the "Deposit applied" or
 * "Credit applied" Receipt that applied each, with what it prints:
 * "Deposit applied (REC-0003)".
 */
export function depositsAppliedTo(
  db: Db,
  invoiceId: string,
): { receiptNumber: string; amount: Cents; kind: 'deposit' | 'credit'; label: string }[] {
  return db
    .all(
      `SELECT d.printed_number, a.from_kind, sum(a.amount) AS amount FROM allocation a
       JOIN journal_entry e ON e.id = a.journal_entry_id JOIN document d ON d.id = e.source_id
       WHERE a.to_kind = 'invoice' AND a.to_id = ? AND a.from_kind IN ('deposit', 'credit') AND ${LIVE('a')}
       GROUP BY d.id, a.from_kind ORDER BY d.number`,
      [invoiceId],
    )
    .map((r) => {
      const kind = r.from_kind === 'credit' ? ('credit' as const) : ('deposit' as const);
      const receiptNumber = String(r.printed_number);
      return {
        receiptNumber,
        amount: Number(r.amount),
        kind,
        label: `${kind === 'credit' ? 'Credit' : 'Deposit'} applied (${receiptNumber})`,
      };
    });
}
