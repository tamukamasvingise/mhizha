// Payments and Receipts (spec section 6), plain TypeScript over the records,
// free of React. Screens use `payments(useDb(), Date.now)`.
//
// A Payment pays one or more of a Customer's Issued Invoices. Saving it issues
// its Receipt at once (there are no Draft Receipts), or one Payment and
// Receipt per Invoice when Separate receipts is chosen. The Payment, what it
// paid (allocations), the Receipt, its lines and the ledger entry are one
// save: all of it, or nothing.
import {
  dateReceivedProblem,
  formatUsd,
  invoiceStatus,
  PAYMENT_METHODS,
  postings,
  sumInWords,
  type Cents,
  type EntryLine,
  type InvoiceStatus,
  type PaymentMethod,
} from '../core';
import type { Db } from '../db';
import type { FrozenCopy } from '../documents';
import { lastRecordedAt, postEntry } from '../ledger';
import { addressLine, InputError, people } from '../people';
import type { ReceiptPrint } from '../pdf/receipt';
import { longDateTime, TIME_ZONE, todayAt } from '../setup/dates';
import { businessDetails, documentCounters, formatNumber } from '../setup/store';
import { appliedTo } from './allocations';

export { appliedTo } from './allocations';

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

export type PaymentInput = {
  customerId: string;
  /** The amount received. */
  amount: Cents;
  /** YYYY-MM-DD: today or earlier. */
  dateReceived: string;
  method: PaymentMethod;
  /** Required for Other: how they paid. */
  otherDescription: string;
  /** What goes on each Invoice; together they make the amount. */
  parts: readonly { invoiceId: string; amount: Cents }[];
  /** One Payment and Receipt per Invoice instead of one for all. */
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
  customerId: string;
  customerName: string;
  issuedAt: string;
  issueDate: string;
  dateReceived: string;
  /** As printed: "Cash", or "Other: Cheque". */
  method: string;
  methodCode: PaymentMethod;
  amount: Cents;
  sumInWords: string;
  lines: ReceiptLine[];
  frozen: FrozenCopy;
  pdfFileId: string | null;
};

const NO_SITE: FrozenCopy['site'] = {
  name: '',
  address: { lines: '', suburb: '', city: '', province: '', country: '' },
  contactName: '',
  contactPhone: '',
};

/** "INV-0001", "INV-0001 and INV-0002", "INV-0001, INV-0002 and INV-0003". */
function listed(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function payments(db: Db, clock: () => number) {
  const today = () => todayAt(clock());
  const p = people(db, today);

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

  function receiptCounter() {
    const c = documentCounters(db).find((x) => x.type === 'REC')!;
    return { ...c, next: c.lastNumber == null ? c.startingNumber : c.lastNumber + 1 };
  }

  /** The Payments a save makes: one, or one per Invoice. */
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
      const r = invoiceRow(part.invoiceId);
      if (!r || String(r.customer_id) !== input.customerId || seen.has(part.invoiceId)) {
        problems.parts ??= "Tick only this Customer's Invoices, each once.";
        continue;
      }
      seen.add(part.invoiceId);
      const o = owingOf(r);
      if (!Number.isSafeInteger(part.amount) || part.amount <= 0) problems.parts ??= `Put more than US$0.00 on ${o.number}, or untick it.`;
      else if (part.amount > o.owed) problems.parts ??= `${o.number} owes ${formatUsd(o.owed)}. Put no more than that on it.`;
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
    const issueDate = todayAt(at);
    const amount = parts.reduce((s, x) => s + x.amount, 0);
    const c = receiptCounter();
    const number = formatNumber(c.prefix, c.next);
    db.update('document_counter', String(db.get("SELECT id FROM document_counter WHERE type = 'REC'")!.id), { last_number: c.next });

    const cust = p.customer(input.customerId);
    const owing = parts.map((x) => ({ part: x, invoice: owingOf(invoiceRow(x.invoiceId)!), row: invoiceRow(x.invoiceId)! }));
    const jobs = [...new Set(owing.map((o) => String(o.row.job_id)))];
    const frozen: FrozenCopy = {
      business: (businessDetails(db, issueDate) ?? businessDetails(db))!,
      customer: {
        kind: cust.kind, name: cust.name, phones: cust.phones, whatsapp: cust.whatsapp, email: cust.email, address: cust.address, taxNumber: cust.taxNumber,
      },
      site: NO_SITE,
      job: { title: listed([...new Set(owing.map((o) => o.invoice.jobTitle))]) },
    };
    const receiptId = db.insert('document', {
      type: 'REC',
      customer_id: input.customerId,
      job_id: jobs.length === 1 ? jobs[0]! : null,
      number: c.next,
      printed_number: number,
      issued_at: issuedAt,
      time_zone: TIME_ZONE,
      issue_date: issueDate,
      tax_status: 'not registered',
      subtotal: amount,
      discount_cents: 0,
      total: amount,
      sum_in_words: sumInWords(amount),
      frozen: JSON.stringify(frozen),
    });

    // Money received before an Invoice's date is held for the Customer as
    // Credit until that date, then applied to it (spec section 9).
    const onTime = owing.filter((o) => o.invoice.issueDate <= input.dateReceived);
    const early = owing.filter((o) => o.invoice.issueDate > input.dateReceived);
    const sum = (xs: typeof owing) => xs.reduce((s, o) => s + o.part.amount, 0);
    const lines: EntryLine[] = postings.payment({
      customerId: input.customerId,
      method: input.method,
      toInvoices: sum(onTime),
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
    owing.forEach((o, i) => {
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
        position: i + 1,
        invoice_id: o.invoice.id,
        job_id: String(o.row.job_id),
        applied_to: o.invoice.number,
        job_title: o.invoice.jobTitle,
        total: o.invoice.total,
        amount: o.part.amount,
        balance_left: o.invoice.owed - o.part.amount,
      });
    });
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
      const c = receiptCounter();
      return { problems, warnings, receipts: groups(input).map((_, i) => formatNumber(c.prefix, c.next + i)) };
    },

    /**
     * Saves the Payment and issues its Receipt (or one per Invoice), all in one
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
      const pay = db.get('SELECT * FROM payment WHERE receipt_id = ?', [id])!;
      const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
      const code = String(pay.method_code) as PaymentMethod;
      return {
        id,
        number: String(r.printed_number),
        customerId: String(r.customer_id),
        customerName: frozen.customer.name,
        issuedAt: String(r.issued_at),
        issueDate: String(r.issue_date),
        dateReceived: String(pay.date_received),
        method: methodText(code, String(pay.other_description)),
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
      };
    },
  };
}

export type Payments = ReturnType<typeof payments>;
