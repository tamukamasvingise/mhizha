// Refunds (spec sections 6 and 9): money paid back to a Customer from an
// unused Deposit on one of their Quotations, or from their Credit, up to what
// is held. A Refund is a locked Document REF-0001 with its record (amount,
// date, method, reason), the allocations from the Deposit or Credit it used,
// and the entry Deposits or Credit held / the money account, all in one save.
import { formatUsd, isAccountingDate, PAYMENT_METHODS, postings, type Cents, type PaymentMethod } from '../core';
import { shortDate } from '../dates';
import type { Db } from '../db';
import type { FrozenCopy } from '../documents';
import { lastRecordedAt, postEntry } from '../ledger';
import { addressLine, InputError } from '../people';
import { longDate, longDateTime, todayAt } from '../setup/dates';
import { businessDetails, formatNumber, type BusinessDetails } from '../setup/store';
import { creditLots, creditTaken, useCredit } from './credit';
import { depositLots, useLots } from './deposits';
import { counterOf, issueMoneyDocument, listed } from './receipts';

/** What a Refund can pay back from: a Deposit on a Quotation, or the Customer's Credit. */
export type RefundFrom = { kind: 'deposit'; quotationId: string } | { kind: 'credit' };

/** Something held for the Customer that can be refunded, with how it was paid (to suggest the same way back). */
export type RefundSource =
  | { kind: 'deposit'; quotationId: string; title: string; held: Cents; method: PaymentMethod | null }
  | { kind: 'credit'; title: string; held: Cents; method: PaymentMethod | null };

export type RefundInput = {
  customerId: string;
  from: RefundFrom;
  amount: Cents;
  /** YYYY-MM-DD: the day the money was paid back; today or earlier. */
  date: string;
  method: PaymentMethod;
  otherDescription: string;
  reason: string;
};

export type Refund = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  issuedAt: string;
  issueDate: string;
  /** The day the money was paid back. */
  date: string;
  amount: Cents;
  /** As printed: "EcoCash", or "Other: Cheque". */
  method: string;
  methodCode: PaymentMethod;
  otherDescription: string;
  reason: string;
  from: 'deposit' | 'credit';
  quotationId: string | null;
  /** "Unused Deposit on QUO-0010, paid on REC-0015 (2 Oct 2026)". */
  refundOf: string;
  sumInWords: string;
  frozen: FrozenCopy;
  pdfFileId: string | null;
};

/** What a Refund prints, from its frozen copy. */
export type RefundPrint = {
  number: string;
  issueDate: string;
  date: string;
  business: BusinessDetails;
  customer: { name: string; address: string; phones: readonly string[] };
  sumInWords: string;
  refundOf: string;
  reason: string;
  method: PaymentMethod;
  otherDescription: string;
  amount: Cents;
};

type Taken = { receiptNumber: string | null; dateReceived: string; heldFrom: string; method: PaymentMethod | null; take: Cents };

/** Where money came from, in words: "REC-0015 (2 Oct 2026)", or the opening balance. */
function origins(xs: readonly { number: string | null; dateReceived: string }[]): string {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const x of xs) {
    const w = x.number === null ? `the opening balance (${shortDate(x.dateReceived)})` : `${x.number} (${shortDate(x.dateReceived)})`;
    if (!seen.has(w)) (seen.add(w), words.push(w));
  }
  return listed(words);
}

export function refunds(db: Db, clock: () => number) {
  const today = () => todayAt(clock());

  function methodName(code: PaymentMethod, other: string): string {
    const r = db.get('SELECT name FROM payment_method WHERE code = ?', [code]);
    const name = r ? String(r.name) : code;
    return code === 'other' && other ? `${name}: ${other}` : name;
  }

  /** The Customer's Quotations holding a Deposit: the latest version of each number. */
  function depositQuotations(customerId: string): { id: string; number: string }[] {
    const seen = new Set<number>();
    const out: { id: string; number: string }[] = [];
    for (const r of db.all(
      "SELECT id, number, printed_number FROM document WHERE customer_id = ? AND type = 'QUO' AND number IS NOT NULL ORDER BY number, revision DESC",
      [customerId],
    )) {
      if (seen.has(Number(r.number))) continue;
      seen.add(Number(r.number));
      out.push({ id: String(r.id), number: String(r.printed_number) });
    }
    return out;
  }

  /** What `amount` would take from the source, oldest first; null when it holds less. */
  function taken(customerId: string, from: RefundFrom, amount: Cents): Taken[] | null {
    if (from.kind === 'credit') {
      const held = creditLots(db, customerId).reduce((s, l) => s + l.left, 0);
      if (amount > held) return null;
      return creditTaken(db, customerId, amount).map(({ lot, take }) => ({ ...lot, take }));
    }
    let rest = amount;
    const out: Taken[] = [];
    for (const lot of depositLots(db, from.quotationId)) {
      if (rest === 0) break;
      const take = Math.min(lot.left, rest);
      if (take <= 0) continue;
      const pay = db.get(
        'SELECT p.method_code FROM allocation a JOIN payment p ON a.from_kind = ? AND p.id = a.from_id WHERE a.id = ?',
        ['payment', lot.id],
      );
      out.push({
        receiptNumber: lot.receiptNumber,
        dateReceived: lot.dateReceived,
        heldFrom: lot.dateReceived,
        method: pay ? (String(pay.method_code) as PaymentMethod) : null,
        take,
      });
      rest -= take;
    }
    return rest > 0 ? null : out;
  }

  function sources(customerId: string): RefundSource[] {
    const out: RefundSource[] = [];
    for (const q of depositQuotations(customerId)) {
      const held = depositLots(db, q.id).reduce((s, l) => s + l.left, 0);
      if (held <= 0) continue;
      const last = taken(customerId, { kind: 'deposit', quotationId: q.id }, held)!.at(-1);
      out.push({ kind: 'deposit', quotationId: q.id, title: `Deposit on ${q.number}`, held, method: last?.method ?? null });
    }
    const credit = creditLots(db, customerId).filter((l) => l.left > 0);
    const held = credit.reduce((s, l) => s + l.left, 0);
    if (held > 0) out.push({ kind: 'credit', title: 'Credit', held, method: credit.at(-1)!.method });
    return out;
  }

  function problemsOf(input: RefundInput): Record<string, string> {
    const problems: Record<string, string> = {};
    const last = lastRecordedAt(db);
    if (last !== null && new Date(clock()).toISOString() < last)
      problems.clock = `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then save.`;
    const source = sources(input.customerId).find((s) =>
      input.from.kind === 'credit' ? s.kind === 'credit' : s.kind === 'deposit' && s.quotationId === input.from.quotationId,
    );
    if (!source) problems.from = 'Pick the Deposit or Credit to refund.';
    else if (!Number.isSafeInteger(input.amount) || input.amount <= 0) problems.amount = 'Enter the amount paid back, more than US$0.00.';
    else if (input.amount > source.held)
      problems.amount =
        source.kind === 'credit'
          ? `Refund at most ${formatUsd(source.held)}, the Credit held.`
          : `Refund at most ${formatUsd(source.held)}, the ${source.title} held.`;
    if (!isAccountingDate(input.date)) problems.date = 'Pick the day the money was paid back.';
    else if (input.date > today()) problems.date = "The Refund date can't be after today.";
    else if (source && !problems.amount) {
      const came = (taken(input.customerId, input.from, input.amount) ?? []).reduce((m, t) => (t.heldFrom > m ? t.heldFrom : m), '');
      if (came && input.date < came) problems.date = `The money came in on ${longDate(came)}; the Refund can't be before that.`;
    }
    if (!PAYMENT_METHODS.includes(input.method)) problems.method = 'Pick how you paid it back.';
    else if (input.method === 'other' && input.otherDescription.trim() === '')
      problems.other = 'Say how you paid it back, for example "Cheque".';
    if (input.reason.trim() === '') problems.reason = 'Say why the money is paid back.';
    if (!businessDetails(db)) problems.business = 'Enter your business details in Settings first.';
    return problems;
  }

  function refundOfText(r: { from: 'deposit' | 'credit'; quotationNumber: string | null; documentId: string }): string {
    if (r.from === 'credit') {
      const xs = db
        .all(
          `SELECT u.from_id FROM allocation u WHERE u.from_kind IN ('credit', 'opening-credit') AND u.to_kind = 'refund' AND u.to_id = ? ORDER BY u.rowid`,
          [r.documentId],
        )
        .map((x) => String(x.from_id));
      const customer = String(db.get('SELECT customer_id FROM document WHERE id = ?', [r.documentId])!.customer_id);
      const lots = creditLots(db, customer).filter((l) => xs.includes(l.id));
      return `Unused Credit, from ${origins(lots.map((l) => ({ number: l.receiptNumber, dateReceived: l.dateReceived })))}`;
    }
    const rows = db.all(
      `SELECT d.printed_number, le.accounting_date FROM allocation u
         JOIN allocation lot ON lot.id = u.from_id JOIN journal_entry le ON le.id = lot.journal_entry_id
         LEFT JOIN payment p ON lot.from_kind = 'payment' AND p.id = lot.from_id LEFT JOIN document d ON d.id = p.receipt_id
       WHERE u.from_kind = 'deposit' AND u.to_kind = 'refund' AND u.to_id = ? ORDER BY le.accounting_date, u.rowid`,
      [r.documentId],
    );
    const from = origins(rows.map((x) => ({ number: x.printed_number == null ? null : String(x.printed_number), dateReceived: String(x.accounting_date) })));
    const paid = rows.every((x) => x.printed_number == null) ? `from ${from}` : `paid on ${from}`;
    return `Unused Deposit on ${r.quotationNumber}, ${paid}`;
  }

  function refund(id: string): Refund {
    const r = db.get(
      `SELECT d.*, f.from_kind, f.quotation_id AS refund_quotation, f.refund_date, f.method_code, f.other_description, f.reason, q.printed_number AS quotation_number
       FROM document d JOIN refund f ON f.document_id = d.id LEFT JOIN document q ON q.id = f.quotation_id
       WHERE d.id = ? AND d.type = 'REF'`,
      [id],
    );
    if (!r) throw new Error(`No Refund ${id}`);
    const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
    const code = String(r.method_code) as PaymentMethod;
    const from = r.from_kind === 'deposit' ? 'deposit' : 'credit';
    return {
      id,
      number: String(r.printed_number),
      customerId: String(r.customer_id),
      customerName: frozen.customer.name,
      issuedAt: String(r.issued_at),
      issueDate: String(r.issue_date),
      date: String(r.refund_date),
      amount: Number(r.total),
      method: methodName(code, String(r.other_description)),
      methodCode: code,
      otherDescription: String(r.other_description),
      reason: String(r.reason),
      from,
      quotationId: r.refund_quotation == null ? null : String(r.refund_quotation),
      refundOf: refundOfText({ from, quotationNumber: r.quotation_number == null ? null : String(r.quotation_number), documentId: id }),
      sumInWords: String(r.sum_in_words),
      frozen,
      pdfFileId: r.pdf_file_id == null ? null : String(r.pdf_file_id),
    };
  }

  return {
    /** What the Customer has held that can be paid back: each Deposit, then Credit. */
    sources,

    /** The problems that stop the Refund, and the number it would get. */
    check(input: RefundInput): { problems: Record<string, string>; number: string } {
      const c = counterOf(db, 'REF');
      return { problems: problemsOf(input), number: formatNumber(c.prefix, c.next) };
    },

    /** Issues the Refund in one save. Throws InputError, saving nothing, when anything is wrong. Returns its id. */
    record(input: RefundInput): string {
      return db.transaction(() => {
        const problems = problemsOf(input);
        if (Object.keys(problems).length > 0) throw new InputError(problems);
        const at = clock();
        const quotation =
          input.from.kind === 'deposit'
            ? db.get('SELECT job_id, frozen FROM document WHERE id = ?', [input.from.quotationId])!
            : null;
        const doc = issueMoneyDocument(db, 'REF', {
          customerId: input.customerId,
          jobIds: quotation?.job_id == null ? [] : [String(quotation.job_id)],
          jobTitles: quotation ? [(JSON.parse(String(quotation.frozen)) as FrozenCopy).job.title] : [],
          amount: input.amount,
          at,
        });
        const entryId = postEntry(db, {
          accountingDate: input.date,
          recordedAt: new Date(at).toISOString(),
          source: { kind: 'refund', id: doc.id },
          lines: postings.refund({ customerId: input.customerId, from: input.from.kind, method: input.method, amount: input.amount }),
          reason: input.reason.trim(),
        });
        const to = { kind: 'refund' as const, id: doc.id, entryId };
        if (input.from.kind === 'deposit') useLots(db, input.from.quotationId, input.amount, to);
        else useCredit(db, input.customerId, input.amount, to);
        db.insert('refund', {
          customer_id: input.customerId,
          document_id: doc.id,
          from_kind: input.from.kind,
          quotation_id: input.from.kind === 'deposit' ? input.from.quotationId : null,
          refund_date: input.date,
          method_code: input.method,
          other_description: input.method === 'other' ? input.otherDescription.trim() : '',
          amount: input.amount,
          reason: input.reason.trim(),
          journal_entry_id: entryId,
        });
        return doc.id;
      });
    },

    refund,

    /** What the Refund prints, from its frozen copy. */
    printable(id: string): RefundPrint {
      const x = refund(id);
      const f = x.frozen;
      return {
        number: x.number,
        issueDate: x.issueDate,
        date: x.date,
        business: f.business,
        customer: { name: f.customer.name, address: addressLine(f.customer.address), phones: f.customer.phones },
        sumInWords: x.sumInWords,
        refundOf: x.refundOf,
        reason: x.reason,
        method: x.methodCode,
        otherDescription: x.otherDescription,
        amount: x.amount,
      };
    },
  };
}
