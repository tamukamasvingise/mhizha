// Documents (spec section 6): Drafts and Issued Invoices, plain TypeScript
// over the records, free of React. Screens use `documents(useDb(), Date.now)`.
//
// A Draft has no number, is freely changed and may be deleted (a marker is
// left). Issuing gives it the next number, the real date and time, a frozen
// copy of the details it prints, and posts Customers owe / Sales, all in one
// save; after that the database refuses any change. Statuses are worked out.
import {
  documentTotals,
  invoiceStatus,
  issuableTotals,
  isAccountingDate,
  lineAmount,
  MoneyError,
  postings,
  sumInWords,
  type Cents,
  type Discount,
  type InvoiceStatus,
  type Thousandths,
  type Totals,
} from '../core';
import type { Db, Row } from '../db';
import { lastRecordedAt, postEntry } from '../ledger';
import { appliedTo } from '../payments/allocations';
import { addressLine, InputError, people, type Address, type CustomerKind } from '../people';
import type { InvoicePrint } from '../pdf/invoice';
import type { PriceItem } from '../prices/priceList';
import { longDateTime, TIME_ZONE, todayAt } from '../setup/dates';
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
  /** An Invoice's worked-out status; 'received' for a money Receipt. */
  status: InvoiceStatus | 'draft' | 'received';
};

const TYPE_NAMES: Record<DocumentType, string> = { QUO: 'Quotation', INV: 'Invoice', REC: 'Receipt', REF: 'Refund' };
const FILTER_TYPES: Record<Exclude<ListFilter, 'all' | 'drafts'>, DocumentType[]> = {
  quotations: ['QUO'],
  invoices: ['INV'],
  receipts: ['REC'],
};

const TAX_STATUS = 'not registered';

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

function printOf(f: FrozenCopy, n: PrintedNumbers): InvoicePrint {
  return {
    ...n,
    quoteRef: '',
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
        totals: totalsOf(ls, discount),
      };
    },

    /** Changes who the Draft is for; a Job of the old Customer is dropped. */
    setCustomer(id: string, customerId: string) {
      const r = draftRow(id);
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
        touch(id);
      });
    },

    /** One Discount, as an amount or a percentage; null takes it off. Never above the Subtotal. */
    setDiscount(id: string, discount: Discount | null) {
      draftRow(id);
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

    /** Deletes a Draft: it leaves a marker and goes from every list. Issued Documents are never deleted. */
    deleteDraft(id: string) {
      draftRow(id);
      touch(id, { deleted_at: new Date(clock()).toISOString() });
    },

    /** The number the next Document of this type gets. */
    nextNumber(type: DocumentType): string {
      const c = counter(type);
      return formatNumber(c.prefix, c.next);
    },

    /**
     * Issues a Draft Invoice: number, date and time, frozen copy, tax status and the
     * Customers owe / Sales entry, all in one save. Returns the printed number.
     */
    issue(id: string): string {
      return db.transaction(() => {
        const draft = this.draft(id);
        const at = clock();
        const issuedAt = new Date(at).toISOString();
        const issueDate = todayAt(at);
        const problems: Record<string, string> = {};
        const last = lastRecordedAt(db);
        if (last !== null && issuedAt < last)
          problems.clock = `The phone's clock is earlier than your last record (${longDateTime(last)}). Set the phone's date and time right, then issue.`;
        if (draft.jobId === null) problems.job = 'Pick the Job this Invoice is for.';
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
        const dueDate = draft.dueDate ?? issueDate;
        if (dueDate < issueDate) problems.dueDate = 'The due date is before today. Pick today or a later day.';
        const frozen = draft.jobId && !problems.job ? frozenCopy(draft.customerId, draft.jobId, issueDate) : null;
        if (!businessDetails(db)) problems.business = 'Enter your business details in Settings first.';
        if (Object.keys(problems).length > 0 || !totals) throw new InputError(problems);

        const c = counter(draft.type);
        const printed = formatNumber(c.prefix, c.next);
        db.update('document_counter', String(db.get('SELECT id FROM document_counter WHERE type = ?', [draft.type])!.id), {
          last_number: c.next,
        });
        db.update('document', id, {
          number: c.next,
          printed_number: printed,
          issued_at: issuedAt,
          time_zone: TIME_ZONE,
          issue_date: issueDate,
          due_date: dueDate,
          tax_status: TAX_STATUS,
          subtotal: totals.subtotal,
          discount_cents: totals.discount,
          total: totals.total,
          sum_in_words: sumInWords(totals.total),
          frozen: JSON.stringify(frozen),
        });
        postEntry(db, {
          accountingDate: issueDate,
          recordedAt: issuedAt,
          source: { kind: 'invoice', id },
          lines: postings.invoiceIssued({ customerId: draft.customerId, total: totals.total }),
        });
        return printed;
      });
    },

    issued(id: string): Issued {
      const r = row(id);
      if (r.number == null) throw new Error(`Document ${id} is a Draft`);
      const total = Number(r.total);
      const dueDate = String(r.due_date);
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
      };
    },

    /**
     * What the Invoice prints. An Issued one prints its frozen copy; a Draft
     * prints as it stands now, with no number, dated today.
     */
    printable(id: string): InvoicePrint {
      const r = row(id);
      if (r.number != null) {
        const inv = this.issued(id);
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
    list({ filter = 'all', customerId, jobId }: { filter?: ListFilter; customerId?: string; jobId?: string } = {}): ListItem[] {
      const where = ['d.deleted_at IS NULL'];
      const params: string[] = [];
      if (filter === 'drafts') where.push('d.number IS NULL');
      else if (filter !== 'all') {
        where.push(`d.type IN (${FILTER_TYPES[filter].map(() => '?').join(', ')})`);
        params.push(...FILTER_TYPES[filter]);
      }
      if (customerId !== undefined) (where.push('d.customer_id = ?'), params.push(customerId));
      if (jobId !== undefined) (where.push('d.job_id = ?'), params.push(jobId));
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
              type === 'REC'
                ? 'received'
                : invoiceStatus({ total, applied: appliedTo(db, String(r.id)), writtenOff: 0, dueDate: String(r.due_date) }, today),
          };
        });
    },
  };
}

export type Documents = ReturnType<typeof documents>;
