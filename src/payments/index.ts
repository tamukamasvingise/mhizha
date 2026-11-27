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
import { longDateTime, todayAt } from '../setup/dates';
import { businessDetails, formatNumber } from '../setup/store';
import { appliedTo } from './allocations';
import { appliedFrom, depositHeld, moveDepositToCredit } from './deposits';
import { issueReceipt, listed, receiptCounter } from './receipts';

export { appliedTo } from './allocations';
export { depositHeld, depositsAppliedTo } from './deposits';

/** An Issued Invoice that still has money owing. */
export type OwingInvoice = {
  id: string;
  number: string;
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

/** What one part of a Payment pays: an Issued Invoice, or a Deposit on an accepted Quotation. */
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
  /** A money Receipt acknowledges a Payment; a "Deposit applied" one, no new money. */
  kind: 'money' | 'deposit-applied';
  /** For a "Deposit applied" Receipt: the Receipts the Deposit was paid on, oldest first; number null for Credit from an Opening balance. */
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

/** "Deposit applied", or "Credit applied from opening balance" when all of it was Credit held on the Start date. */
export function appliedTitle(r: Pick<Receipt, 'appliedFrom'>): string {
  return r.appliedFrom.length > 0 && r.appliedFrom.every((x) => x.number === null) ? 'Credit applied from opening balance' : 'Deposit applied';
}

/** "No new money was received. This applies the Deposit paid on REC-0018 (12 Nov 2026) to the Invoice below." */
export function appliedNotice(r: Pick<Receipt, 'appliedFrom'>): string {
  const paid = r.appliedFrom.filter((x) => x.number !== null).map((x) => `${x.number} (${shortDate(x.dateReceived)})`);
  const opening = r.appliedFrom.filter((x) => x.number === null).map((x) => `Credit held from the opening balance (${shortDate(x.dateReceived)})`);
  const parts = [...(paid.length ? [`the Deposit paid on ${listed(paid)}`] : []), ...opening];
  return `No new money was received. This applies ${listed(parts)} to the Invoice below.`;
}

export function payments(db: Db, clock: () => number) {
  const today = () => todayAt(clock());
  const docs = documents(db, clock);

  function invoiceRow(id: string) {
    return db.get("SELECT * FROM document WHERE id = ? AND type = 'INV' AND number IS NOT NULL AND deleted_at IS NULL", [id]);
  }

  function owingOf(r: NonNullable<ReturnType<typeof invoiceRow>>): OwingInvoice {
    const id = String(r.id);
    const total = Number(r.total);
    const applied = appliedTo(db, id);
    const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
    const dueDate = String(r.due_date);
    return {
      id,
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

  /** The Payments a save makes: one, or one per part. */
  function groups(input: PaymentInput) {
    return input.separate && input.parts.length > 1 ? input.parts.map((part) => [part]) : [input.parts];
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
    if (input.parts.length === 0) problems.parts ??= 'Tick the Invoices this Payment is for.';
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
    if (!problems.amount && !problems.parts && spread !== input.amount) {
      problems.amount =
        spread < input.amount
          ? `${formatUsd(input.amount - spread)} of this is more than the ticked Invoices owe. Lower the amount, or tick another Invoice.`
          : `The amounts on the Invoices add up to ${formatUsd(spread)}, more than the ${formatUsd(input.amount)} received.`;
    }
    if (!businessDetails(db)) problems.business = 'Enter your business details in Settings first.';
    return { problems, warnings };
  }

  /** Saves one Payment and issues its Receipt. Call inside a transaction. */
  function saveOne(input: PaymentInput, parts: PaymentInput['parts']): string {
    const at = clock();
    const issuedAt = new Date(at).toISOString();
    const amount = parts.reduce((s, x) => s + x.amount, 0);

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
      jobIds: [...owing.map((o) => String(o.row.job_id)), ...deposits.map((x) => x.jobId)],
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
      toCredit: sum(early),
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
        to_kind: 'invoice',
        to_id: o.invoice.id,
        amount: o.part.amount,
      });
      db.insert('receipt_line', {
        receipt_id: receiptId,
        position: ++position,
        invoice_id: o.invoice.id,
        job_id: String(o.row.job_id),
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
    return receiptId;
  }

  return {
    /** The Customer's Issued Invoices with money owing, oldest first. */
    owing(customerId: string): OwingInvoice[] {
      return db
        .all(
          `SELECT * FROM document WHERE customer_id = ? AND type = 'INV' AND number IS NOT NULL AND deleted_at IS NULL
           ORDER BY issue_date, issued_at, number`,
          [customerId],
        )
        .map(owingOf)
        .filter((o) => o.owed > 0);
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
        return groups(input).map((parts) => saveOne(input, parts));
      });
    },

    receipt(id: string): Receipt {
      const r = db.get("SELECT * FROM document WHERE id = ? AND type = 'REC' AND number IS NOT NULL", [id]);
      if (!r) throw new Error(`No Receipt ${id}`);
      const pay = db.get('SELECT * FROM payment WHERE receipt_id = ?', [id]);
      const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
      const code = pay ? (String(pay.method_code) as PaymentMethod) : null;
      return {
        id,
        number: String(r.printed_number),
        kind: pay ? 'money' : 'deposit-applied',
        appliedFrom: pay ? [] : appliedFrom(db, id),
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
        beingPaymentFor: listed(x.lines.map((l) => l.appliedTo)),
        lines: x.lines,
        applied: x.kind === 'deposit-applied' ? { title: appliedTitle(x), notice: appliedNotice(x) } : null,
      };
    },
  };
}

export type Payments = ReturnType<typeof payments>;
