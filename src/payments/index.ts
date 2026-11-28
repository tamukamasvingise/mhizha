// Payments and Receipts (spec section 6), plain TypeScript over the records,
// free of React. Screens use `payments(useDb(), Date.now)`.
//
// A Payment pays one or more of a Customer's Issued Invoices, and Deposits on
// their accepted Quotations (held until an Invoice from the Quotation is
// issued; see deposits.ts). Saving it issues its Receipt at once (there are no
// Draft Receipts), or one Payment and Receipt per part when Separate receipts
// is chosen. The Payment, what it paid (allocations), the Receipt, its lines
// and the ledger entry are one save: all of it, or nothing.
import {
  dateReceivedProblem,
  formatUsd,
  invoiceStatus,
  PAYMENT_METHODS,
  postings,
  type Cents,
  type EntryLine,
  type InvoiceStatus,
  type PaymentMethod,
} from '../core';
import { shortDate } from '../dates';
import type { Db } from '../db';
import { documents, type FrozenCopy } from '../documents';
import { lastRecordedAt, postEntry } from '../ledger';
import { addressLine, InputError } from '../people';
import type { ReceiptPrint } from '../pdf/receipt';
import { receiptName } from '../opening';
import { longDateTime, todayAt } from '../setup/dates';
import { businessDetails, formatNumber, startDate } from '../setup/store';
import { appliedTo } from './allocations';
import { applyCredit, appliesCredit, creditFrom, creditHeld } from './credit';
import { appliedFrom, depositHeld, moveDepositToCredit } from './deposits';
import { issueReceipt, listed, receiptCounter } from './receipts';
import { refunds, type RefundInput } from './refunds';

export { appliedTo } from './allocations';
export { creditHeld } from './credit';
export { depositHeld, depositsAppliedTo } from './deposits';
export type { Refund, RefundFrom, RefundInput, RefundPrint, RefundSource } from './refunds';

/** The Receipt line for the part of a Payment kept as Credit. */
export const KEPT_AS_CREDIT = 'Kept as Credit';

/**
 * An Issued Invoice, or an Opening balance item owed (spec section 8), that
 * still has money owing. Both are paid the same way; an Opening balance item
 * is dated at the Start date and has no number of its own.
 */
export type OwingInvoice = {
  id: string;
  kind: 'invoice' | 'opening';
  /** "INV-0001", or "Opening balance (invoice 1234)". */
  number: string;
  /** An Opening balance item's old invoice date, if any. */
  oldDate?: string | null;
  jobTitle: string;
  issueDate: string;
  dueDate: string;
  total: Cents;
  owed: Cents;
  status: InvoiceStatus;
};

/** An accepted Quotation a Deposit can be paid on. */
export type DepositDue = {
  quotationId: string;
  number: string;
  jobTitle: string;
  total: Cents;
  /** The Deposit asked on the Quotation, if any. */
  asked: Cents | null;
  /** Deposit already held on it. */
  held: Cents;
  /** The most a new Deposit can be: what is not yet invoiced or held. */
  room: Cents;
  /** What the Payment screen fills in: the rest of the Deposit asked, or all the room when none was asked. */
  suggested: Cents;
};

/** What one part of a Payment pays: an Issued Invoice (or Opening balance item owed, its id as `invoiceId`), or a Deposit on an accepted Quotation. */
export type PaymentPart = { invoiceId: string; amount: Cents } | { quotationId: string; amount: Cents };

export type PaymentInput = {
  customerId: string;
  /** The amount received. */
  amount: Cents;
  /** YYYY-MM-DD: today or earlier. */
  dateReceived: string;
  method: PaymentMethod;
  /** Required for Other: how they paid. */
  otherDescription: string;
  /** What goes on each Invoice or Deposit; together they make the amount. */
  parts: readonly PaymentPart[];
  /** One Payment and Receipt per part instead of one for all. */
  separate: boolean;
  /**
   * What is more than the parts take, kept as Credit for the Customer once
   * the User has confirmed it. The parts and this make the amount.
   */
  toCredit?: Cents;
};

export type Method = { code: PaymentMethod; name: string; hidden: boolean; needsDescription: boolean };

export type ReceiptLine = {
  appliedTo: string;
  jobTitle: string;
  total: Cents;
  amount: Cents;
  balanceLeft: Cents;
  invoiceId: string | null;
};

export type Receipt = {
  id: string;
  number: string;
  /** A money Receipt acknowledges a Payment; a "Deposit applied" or "Credit applied" one, no new money. */
  kind: 'money' | 'deposit-applied' | 'credit-applied';
  /** For an applied Receipt: the Receipts the Deposit or Credit was paid on, oldest first; number null for Credit from an Opening balance. */
  appliedFrom: { number: string | null; dateReceived: string }[];
  customerId: string;
  customerName: string;
  issuedAt: string;
  issueDate: string;
  /** For a money Receipt; the issue date otherwise. */
  dateReceived: string;
  /** As printed: "Cash", or "Other: Cheque"; empty when no money was received. */
  method: string;
  methodCode: PaymentMethod | null;
  amount: Cents;
  sumInWords: string;
  lines: ReceiptLine[];
  frozen: FrozenCopy;
  pdfFileId: string | null;
};

const isDeposit = (part: PaymentPart): part is { quotationId: string; amount: Cents } => 'quotationId' in part;

/**
 * "Deposit applied" or "Credit applied", or "Credit applied from opening
 * balance" when all of it was Credit held on the Start date.
 */
export function appliedTitle(r: Pick<Receipt, 'appliedFrom' | 'kind'>): string {
  if (r.appliedFrom.length > 0 && r.appliedFrom.every((x) => x.number === null)) return 'Credit applied from opening balance';
  return r.kind === 'credit-applied' ? 'Credit applied' : 'Deposit applied';
}

/**
 * "No new money was received. This applies the Deposit paid on REC-0018 (12 Nov 2026) to the Invoice below.",
 * or "... applies Credit from REC-0018 (12 Nov 2026) ..." for Credit.
 */
export function appliedNotice(r: Pick<Receipt, 'appliedFrom' | 'kind'>): string {
  const paid = r.appliedFrom.filter((x) => x.number !== null).map((x) => `${x.number} (${shortDate(x.dateReceived)})`);
  const opening = r.appliedFrom.filter((x) => x.number === null).map((x) => `Credit held from the opening balance (${shortDate(x.dateReceived)})`);
  const what = r.kind === 'credit-applied' ? 'Credit from' : 'the Deposit paid on';
  const parts = [...(paid.length ? [`${what} ${listed(paid)}`] : []), ...opening];
  return `No new money was received. This applies ${listed(parts)} to the Invoice below.`;
}

export function payments(db: Db, clock: () => number) {
  const today = () => todayAt(clock());
  const docs = documents(db, clock);
  const refunding = refunds(db, clock);

  /** Why nothing can be saved while the phone's clock is behind the last record, or null. */
  function clockProblem(): string | null {
    const last = lastRecordedAt(db);
    return last !== null && new Date(clock()).toISOString() < last
      ? `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then save.`
      : null;
  }

  function invoiceRow(id: string) {
    return (
      db.get("SELECT *, 'invoice' AS owing_kind FROM document WHERE id = ? AND type = 'INV' AND number IS NOT NULL AND deleted_at IS NULL", [id]) ??
      openingRow(id)
    );
  }

  /** An Opening balance item owed and not Cancelled, shaped like an Invoice row. */
  function openingRow(id: string) {
    return db.get(
      `SELECT o.id, o.customer_id, o.job_id, o.old_number, o.old_date, o.amount AS total, j.title AS job_title, 'opening' AS owing_kind
       FROM opening_balance_item o LEFT JOIN job j ON j.id = o.job_id
       WHERE o.id = ? AND o.kind = 'owed' AND o.cancelled_on IS NULL`,
      [id],
    );
  }

  function owingOf(r: NonNullable<ReturnType<typeof invoiceRow>>): OwingInvoice {
    const id = String(r.id);
    const total = Number(r.total);
    const applied = appliedTo(db, id);
    if (r.owing_kind === 'opening') {
      const start = startDate(db);
      return {
        id,
        kind: 'opening',
        number: receiptName({ oldNumber: String(r.old_number) }),
        oldDate: r.old_date == null ? null : String(r.old_date),
        jobTitle: r.job_title == null ? '' : String(r.job_title),
        issueDate: start,
        dueDate: start,
        total,
        owed: total - applied,
        // An old debt is shown as owed, never as Overdue: its due date is not known.
        status: invoiceStatus({ total, applied, writtenOff: 0, dueDate: today() }, today()),
      };
    }
    const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
    const dueDate = String(r.due_date);
    return {
      id,
      kind: 'invoice',
      number: String(r.printed_number),
      jobTitle: frozen.job.title,
      issueDate: String(r.issue_date),
      dueDate,
      total,
      owed: total - applied,
      status: invoiceStatus({ total, applied, writtenOff: 0, dueDate }, today()),
    };
  }

  /** The Deposit a Quotation can take, or null when it is not an accepted Quotation of this Customer. */
  function depositDue(quotationId: string, customerId: string): DepositDue | null {
    const r = db.get("SELECT customer_id FROM document WHERE id = ? AND type = 'QUO' AND number IS NOT NULL", [quotationId]);
    if (!r || String(r.customer_id) !== customerId) return null;
    const q = docs.quotation(quotationId);
    if (q.status !== 'accepted') return null;
    const held = depositHeld(db, quotationId);
    const room = Math.max(0, q.remaining - held);
    const asked = q.depositAsked;
    return {
      quotationId,
      number: q.number,
      jobTitle: q.frozen.job.title,
      total: q.total,
      asked,
      held,
      room,
      suggested: asked === null ? room : Math.max(0, Math.min(asked - held, room)),
    };
  }

  function methods(): Method[] {
    const hidden = new Map<string, boolean>();
    for (const r of db.all('SELECT method_code, hidden FROM payment_method_change ORDER BY rowid')) {
      hidden.set(String(r.method_code), Number(r.hidden) === 1);
    }
    const rows = db.all('SELECT code, name, needs_description FROM payment_method');
    return PAYMENT_METHODS.map((code) => {
      const r = rows.find((x) => x.code === code)!;
      return { code, name: String(r.name), hidden: hidden.get(code) ?? false, needsDescription: Number(r.needs_description) === 1 };
    });
  }

  function methodText(code: PaymentMethod, other: string): string {
    const name = methods().find((m) => m.code === code)!.name;
    return code === 'other' && other ? `${name}: ${other}` : name;
  }

  /** The Payments a save makes: one, or one per part; Credit kept goes with the last. */
  function groups(input: PaymentInput): { parts: readonly PaymentPart[]; credit: Cents }[] {
    const all = input.separate && input.parts.length > 1 ? input.parts.map((part) => [part]) : [input.parts];
    return all.map((parts, i) => ({ parts, credit: i === all.length - 1 ? (input.toCredit ?? 0) : 0 }));
  }

  /** Every problem with the Payment, by field; and the warnings to show before saving. */
  function problemsOf(input: PaymentInput): { problems: Record<string, string>; warnings: string[] } {
    const problems: Record<string, string> = {};
    const warnings: string[] = [];
    const last = lastRecordedAt(db);
    if (last !== null && new Date(clock()).toISOString() < last)
      problems.clock = `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then save.`;
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) problems.amount = 'Enter the amount received, more than US$0.00.';
    const date = dateReceivedProblem(input.dateReceived, today());
    if (date?.kind === 'error') problems.dateReceived = date.message;
    else if (date) warnings.push(date.message);
    if (!PAYMENT_METHODS.includes(input.method)) problems.method = 'Pick how they paid.';
    else if (input.method === 'other' && input.otherDescription.trim() === '')
      problems.other = 'Say how they paid, for example "Cheque".';
    const toCredit = input.toCredit ?? 0;
    if (!Number.isSafeInteger(toCredit) || toCredit < 0) problems.amount = 'Keep zero or more of it as Credit.';
    if (input.parts.length === 0 && toCredit === 0) problems.parts ??= 'Tick the Invoices this Payment is for.';
    const seen = new Set<string>();
    let spread = 0;
    for (const part of input.parts) {
      const id = isDeposit(part) ? part.quotationId : part.invoiceId;
      if (seen.has(id)) {
        problems.parts ??= "Tick only this Customer's Invoices, each once.";
        continue;
      }
      seen.add(id);
      let name: string;
      if (isDeposit(part)) {
        const due = depositDue(part.quotationId, input.customerId);
        if (!due) {
          const q = db.get("SELECT printed_number, customer_id FROM document WHERE id = ? AND type = 'QUO' AND number IS NOT NULL", [
            part.quotationId,
          ]);
          problems.parts ??=
            q && String(q.customer_id) === input.customerId
              ? `${String(q.printed_number)} is not Accepted, so it can take no Deposit.`
              : "Tick only this Customer's Quotations, each once.";
          continue;
        }
        name = `the Deposit on ${due.number}`;
        if (Number.isSafeInteger(part.amount) && part.amount > due.room) {
          problems.parts ??= `A Deposit on ${due.number} can be at most ${formatUsd(due.room)}.`;
          continue;
        }
      } else {
        const r = invoiceRow(part.invoiceId);
        if (!r || String(r.customer_id) !== input.customerId) {
          problems.parts ??= "Tick only this Customer's Invoices, each once.";
          continue;
        }
        const o = owingOf(r);
        name = o.number;
        if (Number.isSafeInteger(part.amount) && part.amount > o.owed) {
          problems.parts ??= `${o.number} owes ${formatUsd(o.owed)}. Put no more than that on it.`;
          continue;
        }
      }
      if (!Number.isSafeInteger(part.amount) || part.amount <= 0) problems.parts ??= `Put more than US$0.00 on ${name}, or untick it.`;
      spread += part.amount;
    }
    if (!problems.amount && !problems.parts && spread + toCredit !== input.amount) {
      problems.amount =
        spread + toCredit < input.amount
          ? `${formatUsd(input.amount - spread - toCredit)} of this is more than the ticked Invoices owe. Lower the amount, tick another Invoice, or keep it as Credit.`
          : toCredit > 0
            ? `The amounts on the Invoices and Credit add up to ${formatUsd(spread + toCredit)}, more than the ${formatUsd(input.amount)} received.`
            : `The amounts on the Invoices add up to ${formatUsd(spread)}, more than the ${formatUsd(input.amount)} received.`;
    }
    if (!businessDetails(db)) problems.business = 'Enter your business details in Settings first.';
    return { problems, warnings };
  }

  /** Saves one Payment and issues its Receipt. Call inside a transaction. */
  function saveOne(input: PaymentInput, parts: PaymentInput['parts'], kept: Cents): string {
    const at = clock();
    const issuedAt = new Date(at).toISOString();
    const amount = parts.reduce((s, x) => s + x.amount, 0) + kept;

    const owing = parts
      .filter((x): x is { invoiceId: string; amount: Cents } => !isDeposit(x))
      .map((x) => {
        const row = invoiceRow(x.invoiceId)!;
        return { part: x, invoice: owingOf(row), row };
      });
    const deposits = parts.filter(isDeposit).map((x) => ({
      part: x,
      due: depositDue(x.quotationId, input.customerId)!,
      jobId: String(db.get('SELECT job_id FROM document WHERE id = ?', [x.quotationId])!.job_id),
    }));
    const receiptId = issueReceipt(db, {
      customerId: input.customerId,
      jobIds: [...owing.filter((o) => o.row.job_id != null).map((o) => String(o.row.job_id)), ...deposits.map((x) => x.jobId)],
      jobTitles: [...owing.map((o) => o.invoice.jobTitle), ...deposits.map((x) => x.due.jobTitle)],
      amount,
      at,
    }).id;

    // Money received before an Invoice's date is held for the Customer as
    // Credit until that date, then applied to it (spec section 9).
    const onTime = owing.filter((o) => o.invoice.issueDate <= input.dateReceived);
    const early = owing.filter((o) => o.invoice.issueDate > input.dateReceived);
    const sum = (xs: readonly { part: PaymentPart }[]) => xs.reduce((s, o) => s + o.part.amount, 0);
    const lines: EntryLine[] = postings.payment({
      customerId: input.customerId,
      method: input.method,
      toInvoices: sum(onTime),
      toDeposits: sum(deposits),
      toCredit: sum(early) + kept,
    });
    const source = { kind: 'receipt', id: receiptId };
    const entryId = postEntry(db, { accountingDate: input.dateReceived, recordedAt: issuedAt, source, lines });
    const payment = db.insert('payment', {
      customer_id: input.customerId,
      receipt_id: receiptId,
      date_received: input.dateReceived,
      method_code: input.method,
      other_description: input.method === 'other' ? input.otherDescription.trim() : '',
      amount,
      separate_receipts: input.separate ? 1 : 0,
      journal_entry_id: entryId,
    });
    let position = 0;
    for (const o of owing) {
      const entry =
        o.invoice.issueDate > input.dateReceived
          ? postEntry(db, {
              accountingDate: o.invoice.issueDate,
              recordedAt: issuedAt,
              source,
              lines: postings.applied({ customerId: input.customerId, from: 'credit', amount: o.part.amount }),
            })
          : entryId;
      db.insert('allocation', {
        journal_entry_id: entry,
        from_kind: 'payment',
        from_id: payment,
        to_kind: o.invoice.kind === 'opening' ? 'opening-balance' : 'invoice',
        to_id: o.invoice.id,
        amount: o.part.amount,
      });
      db.insert('receipt_line', {
        receipt_id: receiptId,
        position: ++position,
        invoice_id: o.invoice.kind === 'invoice' ? o.invoice.id : null,
        opening_balance_id: o.invoice.kind === 'opening' ? o.invoice.id : null,
        job_id: o.row.job_id == null ? null : String(o.row.job_id),
        applied_to: o.invoice.number,
        job_title: o.invoice.jobTitle,
        total: o.invoice.total,
        amount: o.part.amount,
        balance_left: o.invoice.owed - o.part.amount,
      });
    }
    for (const x of deposits) {
      db.insert('allocation', {
        journal_entry_id: entryId,
        from_kind: 'payment',
        from_id: payment,
        to_kind: 'quotation',
        to_id: x.part.quotationId,
        amount: x.part.amount,
      });
      db.insert('receipt_line', {
        receipt_id: receiptId,
        position: ++position,
        invoice_id: null,
        job_id: x.jobId,
        applied_to: `Deposit on ${x.due.number}`,
        job_title: x.due.jobTitle,
        total: x.due.total,
        amount: x.part.amount,
        balance_left: x.due.room - x.part.amount,
      });
    }
    if (kept > 0) {
      // Money more than the parts take, kept as Credit for the Customer.
      db.insert('allocation', {
        journal_entry_id: entryId,
        from_kind: 'payment',
        from_id: payment,
        to_kind: 'credit',
        to_id: input.customerId,
        amount: kept,
      });
      db.insert('receipt_line', {
        receipt_id: receiptId,
        position: ++position,
        invoice_id: null,
        job_id: null,
        applied_to: KEPT_AS_CREDIT,
        job_title: '',
        total: kept,
        amount: kept,
        balance_left: 0,
      });
    }
    return receiptId;
  }

  return {
    /**
     * The Customer's Opening balance items and Issued Invoices with money owing,
     * oldest first: Opening balance items are dated at the Start date, so they come first.
     */
    owing(customerId: string): OwingInvoice[] {
      const opening = db
        .all("SELECT id FROM opening_balance_item WHERE customer_id = ? AND kind = 'owed' AND cancelled_on IS NULL ORDER BY rowid", [customerId])
        .map((r) => openingRow(String(r.id))!);
      const invoices = db.all(
        `SELECT *, 'invoice' AS owing_kind FROM document WHERE customer_id = ? AND type = 'INV' AND number IS NOT NULL AND deleted_at IS NULL
         ORDER BY issue_date, issued_at, number`,
        [customerId],
      );
      return [...opening, ...invoices].map(owingOf).filter((o) => o.owed > 0);
    },

    /** The Customer's accepted Quotations that can still take a Deposit, oldest first. */
    deposits(customerId: string): DepositDue[] {
      return db
        .all(
          `SELECT id FROM document WHERE customer_id = ? AND type = 'QUO' AND number IS NOT NULL
           ORDER BY issue_date, issued_at, number, revision`,
          [customerId],
        )
        .map((r) => depositDue(String(r.id), customerId))
        .filter((x): x is DepositDue => x !== null && x.room > 0);
    },

    /** The unused Deposits on a Job's Quotations, one per Quotation number. */
    depositsOnJob(jobId: string): { quotationId: string; number: string; held: Cents }[] {
      const seen = new Set<number>();
      const out: { quotationId: string; number: string; held: Cents }[] = [];
      for (const r of db.all(
        "SELECT id, number, printed_number FROM document WHERE job_id = ? AND type = 'QUO' AND number IS NOT NULL ORDER BY number, revision DESC",
        [jobId],
      )) {
        if (seen.has(Number(r.number))) continue;
        seen.add(Number(r.number));
        const held = depositHeld(db, String(r.id));
        if (held > 0) out.push({ quotationId: String(r.id), number: String(r.printed_number), held });
      }
      return out;
    },

    /** Moves the unused Deposit on a Quotation to the Customer's Credit, dated today. Returns the amount moved. */
    moveToCredit(quotationId: string): Cents {
      return db.transaction(() => moveDepositToCredit(db, quotationId, clock(), today()));
    },

    /** The six Payment methods, in order, with whether each is hidden. */
    methods,

    /** Hides a method the Business never uses, or shows it again. Old Receipts keep it. */
    setHidden(code: PaymentMethod, hidden: boolean) {
      const all = methods();
      if (hidden && all.every((m) => m.hidden || m.code === code))
        throw new InputError({ method: 'Keep at least one way of being paid.' });
      if (all.find((m) => m.code === code)?.hidden === hidden) return;
      db.insert('payment_method_change', { method_code: code, hidden: hidden ? 1 : 0, effective_from: today() });
    },

    /** What saving would do: the problems that stop it, the warnings, and the Receipt numbers it issues. */
    check(input: PaymentInput): { problems: Record<string, string>; warnings: string[]; receipts: string[] } {
      const { problems, warnings } = problemsOf(input);
      const c = receiptCounter(db);
      return { problems, warnings, receipts: groups(input).map((_, i) => formatNumber(c.prefix, c.next + i)) };
    },

    /**
     * Saves the Payment and issues its Receipt (or one per part), all in one
     * save. Throws InputError, saving nothing, when anything is wrong. Returns the Receipt ids.
     */
    record(input: PaymentInput): string[] {
      return db.transaction(() => {
        const { problems } = problemsOf(input);
        if (Object.keys(problems).length > 0) throw new InputError(problems);
        return groups(input).map((g) => saveOne(input, g.parts, g.credit));
      });
    },

    receipt(id: string): Receipt {
      const r = db.get("SELECT * FROM document WHERE id = ? AND type = 'REC' AND number IS NOT NULL", [id]);
      if (!r) throw new Error(`No Receipt ${id}`);
      const pay = db.get('SELECT * FROM payment WHERE receipt_id = ?', [id]);
      const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
      const code = pay ? (String(pay.method_code) as PaymentMethod) : null;
      const credit = !pay && appliesCredit(db, id);
      return {
        id,
        number: String(r.printed_number),
        kind: pay ? 'money' : credit ? 'credit-applied' : 'deposit-applied',
        appliedFrom: pay ? [] : credit ? creditFrom(db, id, 'invoice') : appliedFrom(db, id),
        customerId: String(r.customer_id),
        customerName: frozen.customer.name,
        issuedAt: String(r.issued_at),
        issueDate: String(r.issue_date),
        dateReceived: pay ? String(pay.date_received) : String(r.issue_date),
        method: code ? methodText(code, String(pay!.other_description)) : '',
        methodCode: code,
        amount: Number(r.total),
        sumInWords: String(r.sum_in_words),
        lines: db.all('SELECT * FROM receipt_line WHERE receipt_id = ? ORDER BY position', [id]).map((l) => ({
          appliedTo: String(l.applied_to),
          jobTitle: String(l.job_title),
          total: Number(l.total),
          amount: Number(l.amount),
          balanceLeft: Number(l.balance_left),
          invoiceId: l.invoice_id == null ? null : String(l.invoice_id),
        })),
        frozen,
        pdfFileId: r.pdf_file_id == null ? null : String(r.pdf_file_id),
      };
    },

    /** What the Receipt prints, from its frozen copy. */
    printable(id: string): ReceiptPrint {
      const x = this.receipt(id);
      const f = x.frozen;
      return {
        number: x.number,
        issueDate: x.issueDate,
        dateReceived: x.dateReceived,
        business: f.business,
        customer: { name: f.customer.name, address: addressLine(f.customer.address), phones: f.customer.phones },
        sumInWords: x.sumInWords,
        method: x.methodCode,
        otherDescription: x.methodCode === 'other' ? x.method.replace(/^[^:]*: /, '') : '',
        amount: x.amount,
        beingPaymentFor: listed(x.lines.map((l) => (l.appliedTo === KEPT_AS_CREDIT ? 'Credit kept for later' : l.appliedTo))),
        lines: x.lines,
        applied: x.kind === 'money' ? null : { title: appliedTitle(x), notice: appliedNotice(x) },
      };
    },

    /** The unused Credit held for the Customer. */
    creditHeld: (customerId: string): Cents => creditHeld(db, customerId),

    /** What Credit could go on an Issued Invoice: what the Customer holds, and the most that can be applied. */
    creditFor(invoiceId: string): { held: Cents; most: Cents } {
      const r = invoiceRow(invoiceId);
      if (!r) return { held: 0, most: 0 };
      const held = creditHeld(db, String(r.customer_id));
      return { held, most: Math.min(held, owingOf(r).owed) };
    },

    /**
     * Applies `amount` of the Customer's Credit to an Issued Invoice, once the
     * User agrees, with a "Credit applied" Receipt. Throws InputError, saving
     * nothing, when it is more than can be applied. Returns the Receipt id.
     */
    applyCredit(invoiceId: string, amount: Cents): string {
      return db.transaction(() => {
        const { most } = this.creditFor(invoiceId);
        const clockIsWrong = clockProblem();
        if (clockIsWrong) throw new InputError({ clock: clockIsWrong });
        if (!Number.isSafeInteger(amount) || amount <= 0) throw new InputError({ amount: 'Apply more than US$0.00 of Credit.' });
        if (amount > most) throw new InputError({ amount: `Apply at most ${formatUsd(most)} of Credit.` });
        return applyCredit(db, { invoiceId, amount, at: clock() });
      });
    },

    /** Applies the Customer's Credit to what they owe, oldest Invoice first, once the User agrees. Returns the Receipt ids. */
    applyCreditToOwing(customerId: string): string[] {
      return db.transaction(() => {
        const ids: string[] = [];
        for (const o of this.owing(customerId)) {
          const { most } = this.creditFor(o.id);
          if (most <= 0) break;
          ids.push(this.applyCredit(o.id, most));
        }
        return ids;
      });
    },

    /** What the Customer has held that can be refunded: each Deposit, then Credit. */
    refundSources: (customerId: string) => refunding.sources(customerId),
    /** The problems that stop a Refund, and the number it would get. */
    checkRefund: (input: RefundInput) => refunding.check(input),
    /** Issues a Refund in one save. Throws InputError, saving nothing, when anything is wrong. Returns its id. */
    refund: (input: RefundInput) => refunding.record(input),
    refundDoc: (id: string) => refunding.refund(id),
    refundPrintable: (id: string) => refunding.printable(id),
  };
}

export type Payments = ReturnType<typeof payments>;
