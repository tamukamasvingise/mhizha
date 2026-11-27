// Documents (spec section 6): Drafts and Issued Invoices, plain TypeScript
// over the records, free of React. Screens use `documents(useDb(), Date.now)`.
//
// A Draft has no number, is freely changed and may be deleted (a marker is
// left). Issuing gives it the next number, the real date and time, a frozen
// copy of the details it prints, and posts Customers owe / Sales, all in one
// save; after that the database refuses any change. Statuses are worked out.
import {
  discountShare,
  documentTotals,
  formatUsd,
  invoiceStatus,
  quotationStatus,
  issuableTotals,
  isAccountingDate,
  lineAmount,
  MoneyError,
  postings,
  sumInWords,
  type Cents,
  type Discount,
  type InvoiceStatus,
  type QuotationStatus,
  type Thousandths,
  type Totals,
} from '../core';
import type { Db, Row } from '../db';
import { lastRecordedAt, postEntry } from '../ledger';
import { appliedTo } from '../payments/allocations';
import { applyDeposit, depositHeld, depositsAppliedTo, moveDepositToCredit } from '../payments/deposits';
import { addressLine, InputError, people, type Address, type CustomerKind } from '../people';
import type { InvoicePrint, QuotationTerms } from '../pdf/invoice';
import { shortDate } from '../dates';
import type { PriceItem } from '../prices/priceList';
import { addDays, daysBetween, longDate, longDateTime, TIME_ZONE, todayAt } from '../setup/dates';
import { businessDetails, documentCounters, emptyBusiness, formatNumber, type BusinessDetails, type DocumentType } from '../setup/store';

export type LineInput = {
  /** Kept when the line was edited, so the same record is changed. */
  id?: string;
  priceListItemId: string | null;
  description: string;
  unit: string;
  quantity: Thousandths;
  unitPrice: Cents;
};

export type Line = LineInput & { id: string; amount: Cents };

export type Draft = {
  id: string;
  type: DocumentType;
  customerId: string;
  jobId: string | null;
  lines: Line[];
  discount: Discount | null;
  orderNo: string;
  /** Empty means the issue date. */
  dueDate: string | null;
  /** A Quotation's valid-until date; empty means 30 days after the issue date. */
  validUntil: string | null;
  /** A Quotation's Deposit asked, in cents, if any. */
  depositAsked: Cents | null;
  /** A Quotation's lead time, in the User's words ("5 working days after the Deposit"). */
  leadTime: string;
  /** For a Revision: the Issued Quotation it replaces. */
  revisesId: string | null;
  /** For an Invoice from a Quotation: that Quotation. */
  quotationId: string | null;
  /** Worked out from the lines; `error` says why the Discount does not fit. */
  totals: Totals & { error?: string };
};

/** What an Issued Document printed, kept inside its own record. */
export type FrozenCopy = {
  business: BusinessDetails;
  customer: { kind: CustomerKind; name: string; phones: string[]; whatsapp: string; email: string; address: Address; taxNumber: string };
  site: { name: string; address: Address; contactName: string; contactPhone: string };
  job: { title: string };
};

export type Issued = {
  id: string;
  type: DocumentType;
  number: string;
  customerId: string;
  jobId: string;
  issuedAt: string;
  timeZone: string;
  issueDate: string;
  dueDate: string;
  orderNo: string;
  taxStatus: 'not registered';
  lines: Line[];
  subtotal: Cents;
  discount: Cents;
  discountKind: Discount | null;
  total: Cents;
  sumInWords: string;
  frozen: FrozenCopy;
  status: InvoiceStatus;
  /** The PDF made at issue; null until it is made. */
  pdfFileId: string | null;
  revision: number;
  revisesId: string | null;
  quotationId: string | null;
  validUntil: string | null;
  depositAsked: Cents | null;
  leadTime: string;
};

export type QuotationAnswer = { kind: 'accepted' | 'declined'; date: string };

/** An Issued Quotation with everything the User has recorded about it, and what was invoiced from it. */
export type Quotation = Omit<Issued, 'status' | 'validUntil'> & {
  validUntil: string;
  status: QuotationStatus;
  answer: QuotationAnswer | null;
  cancelled: { date: string; reason: string } | null;
  /** Every Issued version under this number, Rev 1 first. */
  revisions: { id: string; number: string; revision: number; issueDate: string; status: QuotationStatus }[];
  /** The later Revision that replaced this one. */
  supersededBy: string | null;
  /** A Revision of it not yet issued. */
  draftRevisionId: string | null;
  /** Invoices from it, Drafts included, as list rows. */
  invoices: ListItem[];
  /** Totals of the Issued Invoices from it. */
  invoiced: Cents;
  /** The Total less what was invoiced; below zero when the Invoices came to more. */
  remaining: Cents;
  /** The unused Deposit on it (on any of its versions). */
  depositHeld: Cents;
};

/** What a Draft Invoice from a Quotation is checked against. */
export type FromQuotation = {
  quotationId: string;
  number: string;
  total: Cents;
  /** The Quotation's Discount, and what of it earlier Invoices left. */
  discount: Cents;
  discountLeft: Cents;
  /** The share of the Discount the app fills in for this Draft's Subtotal. */
  suggestedShare: Cents;
  /** Totals of the Invoices issued from it before this one. */
  invoicedBefore: Cents;
  /** How much this Draft and the earlier Invoices come to above the Quotation's Total. */
  over: Cents;
  /** The unused Deposit on the Quotation, applied at issue up to the Invoice total. */
  depositHeld: Cents;
};

export type ListFilter = 'all' | 'drafts' | 'quotations' | 'invoices' | 'receipts';

export type ListItem = {
  id: string;
  type: DocumentType;
  draft: boolean;
  /** "INV-0001", or "Draft Invoice". */
  title: string;
  customerName: string;
  jobTitle: string;
  /** The issue date; for a Draft, the day it was last changed. */
  date: string;
  total: Cents;
  /** Worked out: an Invoice's or Quotation's status; 'received' for a money Receipt, 'applied' for a "Deposit applied" or "Credit applied" one, 'refunded' for a Refund. */
  status: InvoiceStatus | QuotationStatus | 'draft' | 'received' | 'applied' | 'refunded';
};

const TYPE_NAMES: Record<DocumentType, string> = { QUO: 'Quotation', INV: 'Invoice', REC: 'Receipt', REF: 'Refund' };
const FILTER_TYPES: Record<Exclude<ListFilter, 'all' | 'drafts'>, DocumentType[]> = {
  quotations: ['QUO'],
  invoices: ['INV'],
  receipts: ['REC'],
};

const TAX_STATUS = 'not registered';
/** A Quotation is valid for 30 days unless the User picks another day. */
export const VALID_DAYS = 30;

function discountOf(r: Row): Discount | null {
  if (r.discount_kind == null) return null;
  return r.discount_kind === 'percent'
    ? { kind: 'percent', tenths: Number(r.discount_value) }
    : { kind: 'amount', cents: Number(r.discount_value) };
}

function totalsOf(lines: readonly LineInput[], discount: Discount | null): Draft['totals'] {
  try {
    return documentTotals({ lines, discount: discount ?? undefined });
  } catch (e) {
    if (!(e instanceof MoneyError)) throw e;
    const plain = documentTotals({ lines });
    return { ...plain, error: e.message };
  }
}

type PrintedNumbers = Pick<
  InvoicePrint,
  'number' | 'issueDate' | 'dueDate' | 'orderNo' | 'lines' | 'subtotal' | 'discount' | 'discountKind' | 'total' | 'sumInWords'
>;

function printOf(
  f: FrozenCopy,
  n: PrintedNumbers,
  more: { quoteRef?: string; quotation?: QuotationTerms; depositsApplied?: InvoicePrint['depositsApplied'] } = {},
): InvoicePrint {
  return {
    ...n,
    depositsApplied: more.depositsApplied ?? [],
    quoteRef: more.quoteRef ?? '',
    ...(more.quotation ? { quotation: more.quotation } : {}),
    business: f.business,
    customer: { name: f.customer.name, address: addressLine(f.customer.address), phones: f.customer.phones, email: f.customer.email },
    site: {
      location: [f.site.name, addressLine(f.site.address)].filter(Boolean).join(', '),
      contact: [f.site.contactName, f.site.contactPhone].filter(Boolean).join(', '),
    },
    job: f.job.title,
  };
}

export function documents(db: Db, clock: () => number) {
  const p = people(db, () => todayAt(clock()));

  function row(id: string): Row {
    const r = db.get('SELECT * FROM document WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!r) throw new Error(`No document ${id}`);
    return r;
  }

  function draftRow(id: string): Row {
    const r = row(id);
    if (r.number != null) throw new InputError({ document: 'This Document is Issued, so it can no longer change.' });
    return r;
  }

  const lines = (id: string): Line[] =>
    db
      .all('SELECT * FROM document_line WHERE document_id = ? AND deleted_at IS NULL ORDER BY position', [id])
      .map((r) => ({
        id: String(r.id),
        priceListItemId: r.price_list_item_id == null ? null : String(r.price_list_item_id),
        description: String(r.description),
        unit: String(r.unit),
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        amount: Number(r.amount),
      }));

  const touch = (id: string, values: Record<string, string | number | null> = {}) => db.update('document', id, values);

  function jobProblem(customerId: string, jobId: string): string | null {
    const j = db.get('SELECT customer_id FROM job WHERE id = ?', [jobId]);
    if (!j || String(j.customer_id) !== customerId) return 'Pick one of this Customer’s Jobs.';
    return null;
  }

  function counter(type: DocumentType) {
    const c = documentCounters(db).find((x) => x.type === type)!;
    return { ...c, next: c.lastNumber == null ? c.startingNumber : c.lastNumber + 1 };
  }

  function frozenCopy(customerId: string, jobId: string, issueDate: string): FrozenCopy | null {
    const business = businessDetails(db, issueDate) ?? businessDetails(db);
    if (!business) return null;
    const j = p.job(jobId);
    const s = p.site(j.siteId);
    return {
      business,
      ...customerPart(customerId),
      site: { name: s.name, address: s.address, contactName: s.contactName, contactPhone: s.contactPhone },
      job: { title: j.title },
    };
  }

  const issuedRow = (id: string): Row | undefined =>
    db.get('SELECT * FROM document WHERE id = ? AND number IS NOT NULL AND deleted_at IS NULL', [id]);

  /** The latest thing the User recorded about an Issued Quotation. */
  function lastEvent(quotationId: string): Row | undefined {
    return db.get('SELECT * FROM quotation_event WHERE document_id = ? ORDER BY rowid DESC LIMIT 1', [quotationId]);
  }

  /** The Issued Revision that replaced this one, if any. */
  const laterRevision = (r: Row): Row | undefined =>
    db.get(
      "SELECT * FROM document WHERE type = 'QUO' AND number = ? AND revision > ? AND deleted_at IS NULL ORDER BY revision LIMIT 1",
      [Number(r.number), Number(r.revision)],
    );

  function statusOf(r: Row, today: string): QuotationStatus {
    const e = lastEvent(String(r.id));
    const kind = e ? String(e.kind) : null;
    return quotationStatus(
      {
        answer: kind === 'accepted' || kind === 'declined' ? kind : null,
        cancelled: kind === 'cancelled',
        superseded: laterRevision(r) !== undefined,
        validUntil: String(r.valid_until),
      },
      today,
    );
  }

  /** Issued Invoices from a Quotation, oldest first. Cancelled ones will be left out once Invoices can be Cancelled. */
  const invoicesFrom = (quotationId: string): Row[] =>
    db.all(
      "SELECT * FROM document WHERE type = 'INV' AND quotation_id = ? AND number IS NOT NULL AND deleted_at IS NULL ORDER BY issued_at, number",
      [quotationId],
    );

  /** The Issued Quotation, refusing anything else. */
  function quotationRow(id: string): Row {
    const r = issuedRow(id);
    if (!r || r.type !== 'QUO') throw new Error(`No Issued Quotation ${id}`);
    return r;
  }

  function refuseIfInvoiced(q: Row, doing: string) {
    const n = invoicesFrom(String(q.id)).length;
    if (n > 0)
      throw new InputError({
        quotation: `${String(q.printed_number)} has ${n === 1 ? 'an Invoice' : `${n} Invoices`} from it, so it can't be ${doing} now.`,
      });
  }

  function event(q: Row, kind: 'accepted' | 'declined' | 'undone' | 'cancelled', date: string, reason = '') {
    db.insert('quotation_event', { document_id: String(q.id), kind, event_date: date, reason: reason.trim() });
  }

  function answerDate(q: Row, date: string): string {
    const today = todayAt(clock());
    if (!isAccountingDate(date)) throw new InputError({ date: 'Pick the day.' });
    if (date > today) throw new InputError({ date: 'The day can’t be later than today.' });
    if (date < String(q.issue_date))
      throw new InputError({ date: `The day can’t be before the Quotation was issued, ${longDate(String(q.issue_date))}.` });
    return date;
  }

  /** The share of a Quotation's Discount an Invoice with this Subtotal takes, and what of the Discount is left. */
  function share(q: Row, invoiceSubtotal: Cents) {
    const earlier = invoicesFrom(String(q.id));
    const subtotalBefore = earlier.reduce((n, r) => n + Number(r.subtotal), 0);
    const alreadyTaken = earlier.reduce((n, r) => n + Number(r.discount_cents), 0);
    const discount = Number(q.discount_cents);
    const suggested = discountShare({
      discount,
      quotationSubtotal: Number(q.subtotal),
      invoiceSubtotal,
      subtotalBefore,
      alreadyTaken,
      last: subtotalBefore + invoiceSubtotal >= Number(q.subtotal),
    });
    return {
      suggested,
      left: Math.max(0, discount - alreadyTaken),
      invoicedBefore: earlier.reduce((n, r) => n + Number(r.total), 0),
    };
  }

  function quotationTerms(r: { revision: number; revisesId: string | null; issueDate: string; validUntil: string; depositAsked: Cents | null; leadTime: string }): QuotationTerms {
    const before = r.revisesId ? row(r.revisesId) : null;
    const span = daysBetween(r.issueDate, r.validUntil);
    return {
      revisionLine: before ? `Revision ${r.revision} · replaces Rev ${Number(before.revision)} of ${shortDate(String(before.issue_date))}` : '',
      validity: `${span} ${span === 1 ? 'day' : 'days'}, until ${shortDate(r.validUntil)}`,
      validUntil: r.validUntil,
      deposit: r.depositAsked ? `${formatUsd(r.depositAsked).replace('US$', '')} USD on acceptance` : '',
      leadTime: r.leadTime,
    };
  }

  function copyLines(from: string, to: string) {
    lines(from).forEach((l, i) =>
      db.insert('document_line', {
        document_id: to,
        position: i + 1,
        price_list_item_id: l.priceListItemId,
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        amount: l.amount,
      }),
    );
  }

  function customerPart(customerId: string): Pick<FrozenCopy, 'customer'> {
    const c = p.customer(customerId);
    return { customer: { kind: c.kind, name: c.name, phones: c.phones, whatsapp: c.whatsapp, email: c.email, address: c.address, taxNumber: c.taxNumber } };
  }

  return {
    /** A new Draft Invoice for a Customer. */
    newInvoice(customerId: string): string {
      p.customer(customerId);
      return db.insert('document', { type: 'INV', customer_id: customerId });
    },

    /** A new Draft Quotation for a Customer. */
    newQuotation(customerId: string): string {
      p.customer(customerId);
      return db.insert('document', { type: 'QUO', customer_id: customerId });
    },

    draft(id: string): Draft {
      const r = draftRow(id);
      const ls = lines(id);
      const discount = discountOf(r);
      return {
        id,
        type: r.type as DocumentType,
        customerId: String(r.customer_id),
        jobId: r.job_id == null ? null : String(r.job_id),
        lines: ls,
        discount,
        orderNo: String(r.order_no),
        dueDate: r.due_date == null ? null : String(r.due_date),
        validUntil: r.valid_until == null ? null : String(r.valid_until),
        depositAsked: r.deposit_asked == null ? null : Number(r.deposit_asked),
        leadTime: String(r.lead_time),
        revisesId: r.revises_id == null ? null : String(r.revises_id),
        quotationId: r.quotation_id == null ? null : String(r.quotation_id),
        totals: totalsOf(ls, discount),
      };
    },

    /** Changes who the Draft is for; a Job of the old Customer is dropped. */
    setCustomer(id: string, customerId: string) {
      const r = draftRow(id);
      if (r.revises_id != null || r.quotation_id != null)
        throw new InputError({ customer: 'This Draft is for the Customer of its Quotation.' });
      p.customer(customerId);
      const keepJob = r.job_id != null && jobProblem(customerId, String(r.job_id)) === null;
      touch(id, { customer_id: customerId, job_id: keepJob ? String(r.job_id) : null });
    },

    setJob(id: string, jobId: string) {
      const r = draftRow(id);
      const problem = jobProblem(String(r.customer_id), jobId);
      if (problem) throw new InputError({ job: problem });
      touch(id, { job_id: jobId });
    },

    /** A line filled in from a Price list item: its name, unit and price, quantity 1. */
    lineFromPriceItem(item: PriceItem): LineInput {
      return { priceListItemId: item.id, description: item.name, unit: item.unit, quantity: 1000, unitPrice: item.unitPrice };
    },

    /** Replaces the Draft's lines, in order. Lines left out keep a deleted marker. */
    setLines(id: string, input: readonly LineInput[]) {
      draftRow(id);
      if (input.some((l) => l.description.trim() === ''))
        throw new InputError({ lines: 'Every line needs a description.' });
      for (const l of input) lineAmount(l.quantity, l.unitPrice);
      if (input.some((l) => l.quantity <= 0)) throw new InputError({ lines: 'Every line needs a quantity above zero.' });
      const r = row(id);
      // An Invoice from a Quotation keeps the share of its Discount the app
      // filled in in step with its lines, until the User changes the share.
      const q = r.quotation_id == null ? null : row(String(r.quotation_id));
      const followShare =
        q !== null &&
        Number(q.discount_cents) > 0 &&
        (r.discount_kind == null ||
          (r.discount_kind === 'amount' && Number(r.discount_value) === share(q, totalsOf(lines(id), null).subtotal).suggested));
      db.transaction(() => {
        const before = new Set(lines(id).map((l) => l.id));
        input.forEach((l, i) => {
          const values = {
            position: i + 1,
            price_list_item_id: l.priceListItemId,
            description: l.description.trim(),
            unit: l.unit.trim(),
            quantity: l.quantity,
            unit_price: l.unitPrice,
            amount: lineAmount(l.quantity, l.unitPrice),
          };
          if (l.id && before.has(l.id)) {
            db.update('document_line', l.id, values);
            before.delete(l.id);
          } else db.insert('document_line', { document_id: id, ...values });
        });
        const gone = new Date(clock()).toISOString();
        for (const old of before) db.update('document_line', old, { deleted_at: gone });
        if (followShare) {
          const next = share(q!, totalsOf(input, null).subtotal).suggested;
          touch(id, { discount_kind: 'amount', discount_value: next });
        } else touch(id);
      });
    },

    /** One Discount, as an amount or a percentage; null takes it off. Never above the Subtotal. */
    setDiscount(id: string, discount: Discount | null) {
      const r = draftRow(id);
      if (r.quotation_id != null) {
        // From a Quotation: an amount, its share of the Quotation's Discount.
        if (discount?.kind === 'percent')
          throw new InputError({ discount: 'An Invoice from a Quotation takes a share of its Discount, in US$.' });
        const left = share(row(String(r.quotation_id)), 0).left;
        if (discount !== null && discount.cents > left)
          throw new InputError({ discount: `At most ${formatUsd(left)} of the Quotation’s Discount is left.` });
        discount = discount ?? { kind: 'amount', cents: 0 };
      }
      const totals = totalsOf(lines(id), discount);
      if (totals.error) throw new InputError({ discount: totals.error });
      touch(id, {
        discount_kind: discount?.kind ?? null,
        discount_value: discount === null ? null : discount.kind === 'percent' ? discount.tenths : discount.cents,
      });
    },

    /** The due date (null: the issue date) and the Customer's Order No. */
    setDetails(id: string, details: { dueDate: string | null; orderNo: string }) {
      draftRow(id);
      if (details.dueDate !== null && !isAccountingDate(details.dueDate))
        throw new InputError({ dueDate: 'Pick the day it is due.' });
      touch(id, { due_date: details.dueDate, order_no: details.orderNo.trim() });
    },

    /** A Draft Quotation's terms: valid until (null: 30 days after issue), Deposit asked and lead time. */
    setTerms(id: string, terms: { validUntil: string | null; depositAsked: Cents | null; leadTime: string }) {
      const r = draftRow(id);
      if (r.type !== 'QUO') throw new Error('Only a Quotation has terms');
      const today = todayAt(clock());
      if (terms.validUntil !== null && !isAccountingDate(terms.validUntil))
        throw new InputError({ validUntil: 'Pick the last day the prices hold.' });
      if (terms.validUntil !== null && terms.validUntil < today)
        throw new InputError({ validUntil: 'Valid until is before today. Pick today or a later day.' });
      if (terms.depositAsked !== null && (!Number.isSafeInteger(terms.depositAsked) || terms.depositAsked <= 0))
        throw new InputError({ depositAsked: 'Enter the Deposit in US$, above zero, or leave it empty.' });
      touch(id, { valid_until: terms.validUntil, deposit_asked: terms.depositAsked, lead_time: terms.leadTime.trim() });
    },

    /** Deletes a Draft: it leaves a marker and goes from every list. Issued Documents are never deleted. */
    deleteDraft(id: string) {
      draftRow(id);
      touch(id, { deleted_at: new Date(clock()).toISOString() });
    },

    /** The number this Draft gets when issued: a Revision keeps its Quotation's number with the next Rev. */
    numberFor(id: string): string {
      const r = draftRow(id);
      if (r.revises_id == null) return this.nextNumber(r.type as DocumentType);
      const o = row(String(r.revises_id));
      return `${String(o.printed_number).replace(/ Rev \d+$/, '')} Rev ${Number(o.revision) + 1}`;
    },

    /** The number the next Document of this type gets. */
    nextNumber(type: DocumentType): string {
      const c = counter(type);
      return formatNumber(c.prefix, c.next);
    },

    /**
     * Issues a Draft: number, date and time, frozen copy and tax status, all in
     * one save. An Invoice also posts Customers owe / Sales; a Quotation posts
     * nothing. A Revision keeps its Quotation's number with the next Rev.
     * An Invoice from a Quotation applies the Deposit held on it, up to its
     * Total, with a "Deposit applied" Receipt in the same save; `deposit`
     * applies less (0: none), and the rest waits. Returns the printed number.
     */
    issue(id: string, options: { deposit?: Cents } = {}): string {
      return db.transaction(() => {
        const draft = this.draft(id);
        const name = TYPE_NAMES[draft.type];
        const at = clock();
        const issuedAt = new Date(at).toISOString();
        const issueDate = todayAt(at);
        const problems: Record<string, string> = {};
        const last = lastRecordedAt(db);
        if (last !== null && issuedAt < last)
          problems.clock = `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then issue.`;
        if (draft.jobId === null) problems.job = `Pick the Job this ${name} is for.`;
        else {
          const jp = jobProblem(draft.customerId, draft.jobId);
          if (jp) problems.job = jp;
        }
        let totals: Totals | null = null;
        try {
          totals = issuableTotals({ lines: draft.lines, discount: draft.discount ?? undefined });
        } catch (e) {
          if (!(e instanceof MoneyError)) throw e;
          problems[draft.lines.length === 0 ? 'lines' : draft.totals.error ? 'discount' : 'total'] = e.message;
        }
        const quotation = draft.type === 'QUO';
        const dueDate = quotation ? null : (draft.dueDate ?? issueDate);
        if (dueDate !== null && dueDate < issueDate) problems.dueDate = 'The due date is before today. Pick today or a later day.';
        const validUntil = quotation ? (draft.validUntil ?? addDays(issueDate, VALID_DAYS)) : null;
        if (validUntil !== null && validUntil < issueDate) problems.validUntil = 'Valid until is before today. Pick today or a later day.';
        if (quotation && totals && draft.depositAsked !== null && draft.depositAsked > totals.total)
          problems.depositAsked = `The Deposit asked can't be more than the Total, ${formatUsd(totals.total)}.`;

        // A Revision replaces the latest version, which must still be open to change.
        let revisionOf: Row | null = null;
        if (draft.revisesId) {
          revisionOf = row(draft.revisesId);
          const status = statusOf(revisionOf, issueDate);
          if (status === 'superseded' || status === 'cancelled')
            problems.quotation = `${String(revisionOf.printed_number)} is ${status === 'cancelled' ? 'Cancelled' : 'replaced by a later Revision'}, so this Revision can't be issued.`;
          else if (status === 'accepted' && invoicesFrom(draft.revisesId).length > 0)
            problems.quotation = `${String(revisionOf.printed_number)} has an Invoice from it, so it can no longer be revised.`;
        }
        // An Invoice from a Quotation needs it Accepted, and never takes its Discount twice.
        if (draft.quotationId) {
          const q = row(draft.quotationId);
          if (statusOf(q, issueDate) !== 'accepted')
            problems.quotation = `${String(q.printed_number)} is not Accepted now. Mark it Accepted, or make the Invoice without it.`;
          const left = share(q, 0).left;
          if (totals && totals.discount > left)
            problems.discount = `At most ${formatUsd(left)} of the Quotation's Discount is left.`;
        }
        let deposit = 0;
        if (draft.quotationId && totals) {
          const most = Math.min(depositHeld(db, draft.quotationId), totals.total);
          deposit = options.deposit ?? most;
          if (!Number.isSafeInteger(deposit) || deposit < 0 || deposit > most)
            problems.deposit = `Apply at most ${formatUsd(most)} of the Deposit.`;
        }
        const frozen = draft.jobId && !problems.job ? frozenCopy(draft.customerId, draft.jobId, issueDate) : null;
        if (!businessDetails(db)) problems.business = 'Enter your business details in Settings first.';
        if (Object.keys(problems).length > 0 || !totals) throw new InputError(problems);

        let number: number;
        let revision = 1;
        let printed: string;
        if (revisionOf) {
          number = Number(revisionOf.number);
          revision = Number(revisionOf.revision) + 1;
          printed = `${String(revisionOf.printed_number).replace(/ Rev \d+$/, '')} Rev ${revision}`;
        } else {
          const c = counter(draft.type);
          number = c.next;
          printed = formatNumber(c.prefix, c.next);
          db.update('document_counter', String(db.get('SELECT id FROM document_counter WHERE type = ?', [draft.type])!.id), {
            last_number: c.next,
          });
        }
        db.update('document', id, {
          number,
          revision,
          printed_number: printed,
          issued_at: issuedAt,
          time_zone: TIME_ZONE,
          issue_date: issueDate,
          due_date: dueDate,
          valid_until: validUntil,
          tax_status: TAX_STATUS,
          subtotal: totals.subtotal,
          discount_cents: totals.discount,
          total: totals.total,
          sum_in_words: sumInWords(totals.total),
          frozen: JSON.stringify(frozen),
        });
        if (draft.type === 'INV')
          postEntry(db, {
            accountingDate: issueDate,
            recordedAt: issuedAt,
            source: { kind: 'invoice', id },
            lines: postings.invoiceIssued({ customerId: draft.customerId, total: totals.total }),
          });
        if (draft.quotationId && deposit > 0) applyDeposit(db, { quotationId: draft.quotationId, invoiceId: id, amount: deposit, at });
        return printed;
      });
    },

    issued(id: string): Issued {
      const r = row(id);
      if (r.number == null) throw new Error(`Document ${id} is a Draft`);
      const total = Number(r.total);
      const dueDate = String(r.due_date ?? r.issue_date);
      return {
        id,
        type: r.type as DocumentType,
        number: String(r.printed_number),
        customerId: String(r.customer_id),
        jobId: String(r.job_id),
        issuedAt: String(r.issued_at),
        timeZone: String(r.time_zone),
        issueDate: String(r.issue_date),
        dueDate,
        orderNo: String(r.order_no),
        taxStatus: TAX_STATUS,
        lines: lines(id),
        subtotal: Number(r.subtotal),
        discount: Number(r.discount_cents),
        discountKind: discountOf(r),
        total,
        sumInWords: String(r.sum_in_words),
        frozen: JSON.parse(String(r.frozen)) as FrozenCopy,
        // Write-offs come with a later ticket.
        status: invoiceStatus({ total, applied: appliedTo(db, id), writtenOff: 0, dueDate }, todayAt(clock())),
        pdfFileId: r.pdf_file_id == null ? null : String(r.pdf_file_id),
        revision: Number(r.revision),
        revisesId: r.revises_id == null ? null : String(r.revises_id),
        quotationId: r.quotation_id == null ? null : String(r.quotation_id),
        validUntil: r.valid_until == null ? null : String(r.valid_until),
        depositAsked: r.deposit_asked == null ? null : Number(r.deposit_asked),
        leadTime: String(r.lead_time),
      };
    },

    /** An Issued Quotation: its status worked out, the User's answer, its Revisions and the Invoices from it. */
    quotation(id: string): Quotation {
      const r = quotationRow(id);
      const today = todayAt(clock());
      const base = this.issued(id);
      const e = lastEvent(id);
      const kind = e ? String(e.kind) : null;
      const later = laterRevision(r);
      const revisions = db
        .all("SELECT * FROM document WHERE type = 'QUO' AND number = ? AND deleted_at IS NULL ORDER BY revision", [Number(r.number)])
        .map((x) => ({
          id: String(x.id),
          number: String(x.printed_number),
          revision: Number(x.revision),
          issueDate: String(x.issue_date),
          status: statusOf(x, today),
        }));
      const draftRevision = db.get(
        `SELECT d.id FROM document d JOIN document o ON o.id = d.revises_id
         WHERE d.number IS NULL AND d.deleted_at IS NULL AND o.type = 'QUO' AND o.number = ?`,
        [Number(r.number)],
      );
      const invoices = this.list({ quotationId: id });
      const invoiced = invoicesFrom(id).reduce((n, x) => n + Number(x.total), 0);
      return {
        ...base,
        validUntil: String(r.valid_until),
        status: statusOf(r, today),
        answer: kind === 'accepted' || kind === 'declined' ? { kind, date: String(e!.event_date) } : null,
        cancelled: kind === 'cancelled' ? { date: String(e!.event_date), reason: String(e!.reason) } : null,
        revisions,
        supersededBy: later ? String(later.printed_number) : null,
        draftRevisionId: draftRevision ? String(draftRevision.id) : null,
        invoices,
        invoiced,
        remaining: base.total - invoiced,
        depositHeld: depositHeld(db, id),
      };
    },

    /** The warning to show before marking a Quotation Accepted on `date`, or null. Accepting after expiry is allowed. */
    acceptWarning(id: string, date: string): string | null {
      const r = quotationRow(id);
      const until = String(r.valid_until);
      return date > until ? `It expired on ${longDate(until)}. Check the prices still hold.` : null;
    },

    /** Marks the latest version Accepted on a day from its issue to today. A Declined one can become Accepted. */
    accept(id: string, date: string) {
      db.transaction(() => {
        const r = quotationRow(id);
        const status = statusOf(r, todayAt(clock()));
        if (status === 'superseded' || status === 'cancelled')
          throw new InputError({ quotation: 'Only the latest version of a Quotation that is not Cancelled can be accepted.' });
        if (status === 'accepted') throw new InputError({ quotation: `${String(r.printed_number)} is already Accepted.` });
        event(r, 'accepted', answerDate(r, date));
      });
    },

    /** Marks it Declined on a day; refused while an Invoice comes from it. A Deposit on it moves to Credit first. */
    decline(id: string, date: string) {
      db.transaction(() => {
        const r = quotationRow(id);
        const status = statusOf(r, todayAt(clock()));
        if (status === 'superseded' || status === 'cancelled' || status === 'declined')
          throw new InputError({ quotation: `${String(r.printed_number)} can't be declined now.` });
        refuseIfInvoiced(r, 'declined');
        const on = answerDate(r, date);
        moveDepositToCredit(db, id, clock(), todayAt(clock()));
        event(r, 'declined', on);
      });
    },

    /** Takes back Accepted, so it is Issued again; refused while an Invoice comes from it. A Deposit on it moves to Credit first. */
    undoAccept(id: string) {
      db.transaction(() => {
        const r = quotationRow(id);
        if (statusOf(r, todayAt(clock())) !== 'accepted') throw new InputError({ quotation: `${String(r.printed_number)} is not Accepted.` });
        refuseIfInvoiced(r, 'taken back');
        moveDepositToCredit(db, id, clock(), todayAt(clock()));
        event(r, 'undone', todayAt(clock()));
      });
    },

    /** Cancels a Quotation issued by mistake, with a reason; it counts today and stays visible. A Deposit on it moves to Credit first. */
    cancelQuotation(id: string, reason: string) {
      db.transaction(() => {
        const r = quotationRow(id);
        const status = statusOf(r, todayAt(clock()));
        if (status === 'superseded' || status === 'cancelled')
          throw new InputError({ quotation: `${String(r.printed_number)} can't be cancelled now.` });
        if (reason.trim() === '') throw new InputError({ reason: 'Say why it is cancelled.' });
        refuseIfInvoiced(r, 'cancelled');
        moveDepositToCredit(db, id, clock(), todayAt(clock()));
        event(r, 'cancelled', todayAt(clock()), reason);
      });
    },

    /**
     * A Draft Revision of the latest version, copying its Job, lines, Discount,
     * Deposit asked and lead time; the one already started if there is one.
     * An Accepted Quotation can be revised only before an Invoice comes from it.
     */
    revise(id: string): string {
      return db.transaction(() => {
        const r = quotationRow(id);
        const status = statusOf(r, todayAt(clock()));
        if (status === 'superseded' || status === 'cancelled')
          throw new InputError({ quotation: 'Only the latest version of a Quotation that is not Cancelled can be revised.' });
        if (status === 'accepted') refuseIfInvoiced(r, 'revised');
        const started = this.quotation(id).draftRevisionId;
        if (started) return started;
        const draftId = db.insert('document', {
          type: 'QUO',
          customer_id: String(r.customer_id),
          job_id: String(r.job_id),
          revises_id: id,
          discount_kind: r.discount_kind ?? null,
          discount_value: r.discount_value ?? null,
          deposit_asked: r.deposit_asked ?? null,
          lead_time: String(r.lead_time),
        });
        copyLines(id, draftId);
        return draftId;
      });
    },

    /**
     * A Draft Invoice from an Accepted Quotation: its Customer, Job and every
     * line, and its share of the Quotation's Discount. Refused, asking for it
     * to be accepted first, when it is not Accepted.
     */
    invoiceFrom(quotationId: string): string {
      return db.transaction(() => {
        const q = quotationRow(quotationId);
        if (statusOf(q, todayAt(clock())) !== 'accepted')
          throw new InputError({ accept: `Mark ${String(q.printed_number)} Accepted first, then make the Invoice.` });
        const draftId = db.insert('document', {
          type: 'INV',
          customer_id: String(q.customer_id),
          job_id: String(q.job_id),
          quotation_id: quotationId,
        });
        copyLines(quotationId, draftId);
        if (Number(q.discount_cents) > 0)
          touch(draftId, { discount_kind: 'amount', discount_value: share(q, Number(q.subtotal)).suggested });
        return draftId;
      });
    },

    /** For a Draft Invoice from a Quotation: the Quotation's Total, what was invoiced before and the Discount left. */
    fromQuotation(draftId: string): FromQuotation | null {
      const draft = this.draft(draftId);
      if (!draft.quotationId) return null;
      const q = row(draft.quotationId);
      const sh = share(q, draft.totals.subtotal);
      const total = Number(q.total);
      return {
        quotationId: draft.quotationId,
        number: String(q.printed_number),
        total,
        discount: Number(q.discount_cents),
        discountLeft: sh.left,
        suggestedShare: sh.suggested,
        invoicedBefore: sh.invoicedBefore,
        over: Math.max(0, sh.invoicedBefore + draft.totals.total - total),
        depositHeld: depositHeld(db, draft.quotationId),
      };
    },

    /**
     * What the Invoice prints. An Issued one prints its frozen copy; a Draft
     * prints as it stands now, with no number, dated today.
     */
    printable(id: string): InvoicePrint {
      const r = row(id);
      const quoteRef = r.quotation_id == null ? '' : String(row(String(r.quotation_id)).printed_number);
      if (r.number != null) {
        const inv = this.issued(id);
        const quotation = inv.type === 'QUO' ? quotationTerms({ ...inv, validUntil: inv.validUntil! }) : undefined;
        return printOf(inv.frozen, {
          number: inv.number,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          orderNo: inv.orderNo,
          lines: inv.lines,
          subtotal: inv.subtotal,
          discount: inv.discount,
          discountKind: inv.discountKind,
          total: inv.total,
          sumInWords: inv.sumInWords,
        }, {
          quoteRef,
          quotation,
          depositsApplied:
            inv.type === 'INV'
              ? depositsAppliedTo(db, id).map((x) => ({ label: x.label, amount: x.amount }))
              : [],
        });
      }
      const draft = this.draft(id);
      const today = todayAt(clock());
      const frozen = (draft.jobId && jobProblem(draft.customerId, draft.jobId) === null
        ? frozenCopy(draft.customerId, draft.jobId, today)
        : null) ?? {
        business: businessDetails(db, today) ?? businessDetails(db) ?? emptyBusiness(),
        ...customerPart(draft.customerId),
        site: { name: '', address: { lines: '', suburb: '', city: '', province: '', country: '' }, contactName: '', contactPhone: '' },
        job: { title: '' },
      };
      return printOf(frozen, {
        number: null,
        issueDate: today,
        dueDate: draft.dueDate ?? today,
        orderNo: draft.orderNo,
        lines: draft.lines,
        subtotal: draft.totals.subtotal,
        discount: draft.totals.error ? 0 : draft.totals.discount,
        discountKind: draft.totals.error ? null : draft.discount,
        total: draft.totals.total,
        sumInWords: draft.totals.total > 0 ? sumInWords(draft.totals.total) : 'Zero US dollars only',
      }, {
        quoteRef,
        quotation:
          draft.type === 'QUO'
            ? quotationTerms({
                revision: draft.revisesId ? Number(row(draft.revisesId).revision) + 1 : 1,
                revisesId: draft.revisesId,
                issueDate: today,
                validUntil: draft.validUntil ?? addDays(today, VALID_DAYS),
                depositAsked: draft.depositAsked,
                leadTime: draft.leadTime,
              })
            : undefined,
      });
    },

    /** Records the PDF made for an Issued Document. It is set once and never replaced. */
    setPdf(id: string, fileId: string) {
      const r = row(id);
      if (r.number == null) throw new Error('A Draft has no PDF; it is previewed only.');
      if (r.pdf_file_id != null) throw new Error(`Document ${id} already has its PDF`);
      db.update('document', id, { pdf_file_id: fileId });
    },

    /** Drafts first, newest changed first; then Issued, newest first, same day higher number first. */
    list({
      filter = 'all',
      customerId,
      jobId,
      quotationId,
    }: { filter?: ListFilter; customerId?: string; jobId?: string; quotationId?: string } = {}): ListItem[] {
      const where = ['d.deleted_at IS NULL'];
      const params: string[] = [];
      if (filter === 'drafts') where.push('d.number IS NULL');
      else if (filter !== 'all') {
        where.push(`d.type IN (${FILTER_TYPES[filter].map(() => '?').join(', ')})`);
        params.push(...FILTER_TYPES[filter]);
      }
      if (customerId !== undefined) (where.push('d.customer_id = ?'), params.push(customerId));
      if (jobId !== undefined) (where.push('d.job_id = ?'), params.push(jobId));
      if (quotationId !== undefined) (where.push('d.quotation_id = ?'), params.push(quotationId));
      const today = todayAt(clock());
      return db
        .all(
          `SELECT d.*, c.name AS customer_name, j.title AS job_title FROM document d
           JOIN customer c ON c.id = d.customer_id LEFT JOIN job j ON j.id = d.job_id
           WHERE ${where.join(' AND ')}
           ORDER BY d.number IS NOT NULL, CASE WHEN d.number IS NULL THEN d.changed_at END DESC,
             d.issue_date DESC, d.issued_at DESC, d.number DESC`,
          params,
        )
        .map((r): ListItem => {
          const type = r.type as DocumentType;
          if (r.number == null) {
            const ls = lines(String(r.id));
            return {
              id: String(r.id),
              type,
              draft: true,
              title: `Draft ${TYPE_NAMES[type]}`,
              customerName: String(r.customer_name),
              jobTitle: r.job_title == null ? '' : String(r.job_title),
              date: todayAt(Date.parse(String(r.changed_at))),
              total: totalsOf(ls, discountOf(r)).total,
              status: 'draft',
            };
          }
          const frozen = JSON.parse(String(r.frozen)) as FrozenCopy;
          const total = Number(r.total);
          return {
            id: String(r.id),
            type,
            draft: false,
            title: String(r.printed_number),
            customerName: frozen.customer.name,
            jobTitle: frozen.job.title,
            date: String(r.issue_date),
            total,
            status:
              type === 'QUO'
                ? statusOf(r, today)
                : type === 'REF'
                  ? 'refunded'
                  : type === 'REC'
                  ? db.get('SELECT 1 AS x FROM payment WHERE receipt_id = ?', [String(r.id)])
                    ? 'received'
                    : 'applied'
                  : invoiceStatus({ total, applied: appliedTo(db, String(r.id)), writtenOff: 0, dueDate: String(r.due_date) }, today),
          };
        });
    },
  };
}

export type Documents = ReturnType<typeof documents>;
