// Opening balances (spec section 8), plain TypeScript over the records, free of
// React. Screens use `openingBalances(useDb(), Date.now)`.
//
// An Opening balance item is what a Customer owed the Business, or what the
// Business held for them, on the Start date, taken from earlier records. It is
// not a Document: no number and no PDF. It is always dated at the Start date,
// however late it is added. An item owed is paid like an Invoice (see
// src/payments) and never counts as Sales; an item of Credit held can become
// the Deposit of a re-created Quotation. A wrong item is Cancelled with a
// reason (a reversing entry on the day) and entered again.
//
// Sales before the Start date are kept here too: one total per month, used
// only by the VAT threshold warning. They post nothing.
import { formatUsd, isAccountingDate, parseUsd, postings, type Cents } from '../core';
import type { Db, Row } from '../db';
import { documents } from '../documents';
import { lastRecordedAt, postEntry, reverseEntry } from '../ledger';
import { appliedTo } from '../payments/allocations';
import { InputError } from '../people';
import { addMonths, longDate, longDateTime, todayAt } from '../setup/dates';
import { startDate } from '../setup/store';

export type OpeningKind = 'owed' | 'credit';

export type OpeningInput = {
  customerId: string;
  kind: OpeningKind;
  /** The old invoice number, or '' for none. */
  oldNumber: string;
  /** The old invoice's date (YYYY-MM-DD), or null for none. Never after the Start date. */
  oldDate: string | null;
  amount: Cents;
  /** Optional for an item owed; required for Credit held (what the money was for). */
  note: string;
  jobId: string | null;
};

/** Open: still owed or held. Paid: an item owed with nothing left. Used: Credit made a Deposit. */
export type OpeningStatus = 'open' | 'paid' | 'used' | 'cancelled';

export type OpeningItem = {
  id: string;
  customerId: string;
  customerName: string;
  kind: OpeningKind;
  oldNumber: string;
  oldDate: string | null;
  amount: Cents;
  note: string;
  jobId: string | null;
  jobTitle: string;
  /** The Start date: the day it is dated at. */
  date: string;
  /** Owed: what is still owed. Credit: what is not yet made a Deposit. Nothing once Cancelled. */
  left: Cents;
  status: OpeningStatus;
  /** The Quotation its Credit became the Deposit of, if any. */
  depositOn: string | null;
  cancelledOn: string | null;
  cancelReason: string;
};

export const SOURCE_KIND = 'opening-balance';

/** "invoice 1234", or '' for none. */
const invoiceWord = (x: Pick<OpeningItem, 'oldNumber'>) => (x.oldNumber ? `invoice ${x.oldNumber}` : '');

/** As the Customer screen shows it: "Opening balance · invoice 1234 · 3 March 2026 · US$450.00 owed". */
export function openingLine(x: OpeningItem): string {
  const amount = x.kind === 'owed' ? `${formatUsd(x.status === 'cancelled' ? x.amount : x.left)} owed` : `${formatUsd(x.amount)} held for them`;
  return ['Opening balance', invoiceWord(x), x.oldDate ? longDate(x.oldDate) : '', amount, x.kind === 'credit' ? x.note : '']
    .filter(Boolean)
    .join(' · ');
}

/** As a Receipt line names it: "Opening balance (invoice 1234)", or "Opening balance". */
export function receiptName(x: Pick<OpeningItem, 'oldNumber'>): string {
  return x.oldNumber ? `Opening balance (invoice ${x.oldNumber})` : 'Opening balance';
}

const ITEM_SELECT = `SELECT o.*, c.name AS customer_name, j.title AS job_title FROM opening_balance_item o
  JOIN customer c ON c.id = o.customer_id LEFT JOIN job j ON j.id = o.job_id`;

export function openingBalances(db: Db, clock: () => number) {
  const today = () => todayAt(clock());

  /** Credit of this item made a Deposit, and on which Quotation. */
  function deposits(id: string): { amount: Cents; quotation: string | null } {
    const rows = db.all(
      `SELECT a.amount, d.printed_number FROM allocation a LEFT JOIN document d ON d.id = a.to_id
       WHERE a.from_kind = 'opening-credit' AND a.from_id = ? AND a.reverses_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM allocation r WHERE r.reverses_id = a.id)`,
      [id],
    );
    return {
      amount: rows.reduce((s, r) => s + Number(r.amount), 0),
      quotation: rows.length ? String(rows.at(-1)!.printed_number) : null,
    };
  }

  function toItem(r: Row): OpeningItem {
    const id = String(r.id);
    const kind = r.kind as OpeningKind;
    const amount = Number(r.amount);
    const cancelled = r.cancelled_on != null;
    const used = kind === 'owed' ? { amount: appliedTo(db, id), quotation: null } : deposits(id);
    const left = cancelled ? 0 : amount - used.amount;
    return {
      id,
      customerId: String(r.customer_id),
      customerName: String(r.customer_name),
      kind,
      oldNumber: String(r.old_number),
      oldDate: r.old_date == null ? null : String(r.old_date),
      amount,
      note: String(r.note),
      jobId: r.job_id == null ? null : String(r.job_id),
      jobTitle: r.job_title == null ? '' : String(r.job_title),
      date: startDate(db),
      left,
      status: cancelled ? 'cancelled' : left > 0 ? 'open' : kind === 'owed' ? 'paid' : 'used',
      depositOn: used.quotation,
      cancelledOn: cancelled ? String(r.cancelled_on) : null,
      cancelReason: String(r.cancel_reason),
    };
  }

  function item(id: string): OpeningItem {
    const r = db.get(`${ITEM_SELECT} WHERE o.id = ?`, [id]);
    if (!r) throw new Error(`No Opening balance item ${id}`);
    return toItem(r);
  }

  /** The entry the item posted when it was added. */
  function entryOf(id: string): string {
    return String(
      db.get('SELECT id FROM journal_entry WHERE source_kind = ? AND source_id = ? AND reverses_id IS NULL ORDER BY rowid LIMIT 1', [
        SOURCE_KIND,
        id,
      ])!.id,
    );
  }

  function clockProblem(): string | null {
    const last = lastRecordedAt(db);
    return last !== null && new Date(clock()).toISOString() < last
      ? `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then save.`
      : null;
  }

  function problemsOf(x: OpeningInput, start: string): Record<string, string> {
    const problems: Record<string, string> = {};
    if (!db.get('SELECT id FROM customer WHERE id = ?', [x.customerId])) problems.customerId = 'Pick the Customer.';
    if (x.kind !== 'owed' && x.kind !== 'credit') problems.kind = 'Say whether they owed you, or you held their money.';
    if (!Number.isSafeInteger(x.amount) || x.amount <= 0) problems.amount = 'Enter the amount, more than US$0.00.';
    if (x.oldDate !== null) {
      if (!isAccountingDate(x.oldDate)) problems.oldDate = 'Enter a real day, or leave the date empty.';
      else if (x.oldDate > start) problems.oldDate = `The old invoice date can't be after your Start date, ${longDate(start)}.`;
    }
    if (x.kind === 'credit' && x.note.trim() === '')
      problems.note = 'Say what the money was for, for example "Deposit for the roof".';
    if (x.jobId !== null && !db.get('SELECT id FROM job WHERE id = ? AND customer_id = ?', [x.jobId, x.customerId]))
      problems.jobId = "Pick one of this Customer's Jobs, or none.";
    const clockIsWrong = clockProblem();
    if (clockIsWrong) problems.clock = clockIsWrong;
    return problems;
  }

  /** The Customer's Accepted Quotations that an item of Credit held can become the Deposit of. */
  function depositQuotations(id: string): { id: string; number: string; jobTitle: string; total: Cents }[] {
    const x = item(id);
    if (x.kind !== 'credit' || x.status !== 'open') return [];
    return documents(db, clock)
      .list({ filter: 'quotations', customerId: x.customerId })
      .filter((q) => q.status === 'accepted')
      .map((q) => ({ id: q.id, number: q.title, jobTitle: q.jobTitle, total: q.total }));
  }

  return {
    /** Adds an item, dated at the Start date, and posts it in the same save. Throws InputError, saving nothing. */
    add(x: OpeningInput): string {
      return db.transaction(() => {
        const start = startDate(db);
        const problems = problemsOf(x, start);
        if (Object.keys(problems).length > 0) throw new InputError(problems);
        const id = db.insert('opening_balance_item', {
          customer_id: x.customerId,
          kind: x.kind,
          old_number: x.oldNumber.trim(),
          old_date: x.oldDate,
          amount: x.amount,
          note: x.note.trim(),
          job_id: x.jobId,
        });
        postEntry(db, {
          accountingDate: start,
          recordedAt: new Date(clock()).toISOString(),
          source: { kind: SOURCE_KIND, id },
          lines:
            x.kind === 'owed'
              ? postings.openingOwed({ customerId: x.customerId, amount: x.amount })
              : postings.openingCredit({ customerId: x.customerId, amount: x.amount }),
        });
        return id;
      });
    },

    item,

    /** A Customer's items, in the order they were added, Cancelled ones too. */
    items: (customerId: string): OpeningItem[] =>
      db.all(`${ITEM_SELECT} WHERE o.customer_id = ? ORDER BY o.rowid`, [customerId]).map(toItem),

    /** Every item not Cancelled, by Customer name, as the setup step lists them. */
    all: (): OpeningItem[] =>
      db.all(`${ITEM_SELECT} WHERE o.cancelled_on IS NULL ORDER BY c.name COLLATE NOCASE, o.rowid`).map(toItem),

    /**
     * Cancels a wrong item with a reason: its entry is reversed on the day, and
     * the item stays, marked Cancelled. Refused while money is applied to it, or
     * while its Credit is used.
     */
    cancel(id: string, reason: string) {
      db.transaction(() => {
        const x = item(id);
        if (x.status === 'cancelled') throw new InputError({ reason: 'This opening balance is already cancelled.' });
        if (reason.trim() === '') throw new InputError({ reason: 'Give a reason for cancelling.' });
        if (x.kind === 'owed' && x.left < x.amount)
          throw new InputError({ reason: 'A Payment was applied to it. Cancel that Receipt first.' });
        if (x.kind === 'credit' && x.left < x.amount) throw new InputError({ reason: 'This Credit has been used. Undo that first.' });
        const clockIsWrong = clockProblem();
        if (clockIsWrong) throw new InputError({ clock: clockIsWrong });
        const on = today();
        try {
          reverseEntry(db, entryOf(id), { accountingDate: on, recordedAt: new Date(clock()).toISOString(), reason: reason.trim() });
        } catch (e) {
          // The ledger refuses when the Credit it brought in has been used or refunded.
          if (x.kind === 'credit') throw new InputError({ reason: 'This Credit has been used or refunded. Undo that first.' });
          throw e;
        }
        db.update('opening_balance_item', id, { cancelled_on: on, cancel_reason: reason.trim() });
      });
    },

    depositQuotations,

    /**
     * Makes what is left of an item of Credit held the Deposit of an Accepted
     * Quotation (a re-created one, with a new number). Posts Credit held to
     * Deposits held in the same save.
     */
    makeDeposit(id: string, quotationId: string) {
      db.transaction(() => {
        const x = item(id);
        if (x.kind !== 'credit' || x.status !== 'open') throw new InputError({ quotation: 'Nothing is left of this Credit to use.' });
        if (!depositQuotations(id).some((q) => q.id === quotationId))
          throw new InputError({ quotation: "Pick one of this Customer's Accepted Quotations." });
        const clockIsWrong = clockProblem();
        if (clockIsWrong) throw new InputError({ clock: clockIsWrong });
        // Dated at the Start date, as the Credit it moves is: the Deposit's
        // Receipt then says "Credit held from the opening balance (Start date)".
        const entry = postEntry(db, {
          accountingDate: x.date,
          recordedAt: new Date(clock()).toISOString(),
          source: { kind: SOURCE_KIND, id },
          lines: postings.creditToDeposit({ customerId: x.customerId, amount: x.left }),
        });
        db.insert('allocation', {
          journal_entry_id: entry,
          from_kind: 'opening-credit',
          from_id: id,
          to_kind: 'quotation',
          to_id: quotationId,
          amount: x.left,
        });
      });
    },
  };
}

export type Openings = ReturnType<typeof openingBalances>;

/** True when any Opening balance item is dated on the Start date and not Cancelled. */
export function hasOpeningBalances(db: Db): boolean {
  return db.get('SELECT 1 AS x FROM opening_balance_item WHERE cancelled_on IS NULL LIMIT 1') !== undefined;
}

// --- Sales before the Start date ---

export type MonthSales = { month: string; amount: Cents | null };

/** The 12 months before the Start date's month, oldest first, as YYYY-MM. */
export function monthsBeforeStart(start: string): string[] {
  const first = `${start.slice(0, 7)}-01`;
  return Array.from({ length: 12 }, (_, i) => addMonths(first, i - 12).slice(0, 7));
}

/** The sales total entered for each of the 12 months before the Start date; null where left blank. */
export function salesBeforeStart(db: Db): MonthSales[] {
  const saved = new Map(db.all('SELECT month, amount FROM sales_before_start').map((r) => [String(r.month), r.amount]));
  return monthsBeforeStart(startDate(db)).map((month) => {
    const v = saved.get(month);
    return { month, amount: v == null ? null : Number(v) };
  });
}

/** Sets the totals of some months (null leaves a month blank). Posts nothing. */
export function setSalesBeforeStart(db: Db, totals: Readonly<Record<string, Cents | null>>) {
  const months = monthsBeforeStart(startDate(db));
  const problems: Record<string, string> = {};
  for (const [month, amount] of Object.entries(totals)) {
    if (!months.includes(month)) problems[month] = 'Only the 12 months before your Start date can be entered.';
    else if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))
      problems[month] = 'Enter the sales for the month, US$0.00 or more, or leave it empty.';
  }
  if (Object.keys(problems).length > 0) throw new InputError(problems);
  db.transaction(() => {
    for (const [month, amount] of Object.entries(totals)) {
      const r = db.get('SELECT id, amount FROM sales_before_start WHERE month = ?', [month]);
      if (!r) {
        if (amount !== null) db.insert('sales_before_start', { month, amount });
      } else if ((r.amount == null ? null : Number(r.amount)) !== amount) db.update('sales_before_start', String(r.id), { amount });
    }
  });
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2025" for 2025-09. */
export function monthName(month: string): string {
  return `${SHORT_MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** The monthly totals as typed: dollars, or empty for a blank month. Problems by month. */
export function readMonthTotals(texts: Readonly<Record<string, string>>): {
  totals: Record<string, Cents | null>;
  problems: Record<string, string>;
} {
  const totals: Record<string, Cents | null> = {};
  const problems: Record<string, string> = {};
  for (const [month, text] of Object.entries(texts)) {
    if (text.trim() === '') totals[month] = null;
    else {
      const parsed = parseUsd(text);
      if (parsed.ok) totals[month] = parsed.cents;
      else problems[month] = parsed.message;
    }
  }
  return { totals, problems };
}
