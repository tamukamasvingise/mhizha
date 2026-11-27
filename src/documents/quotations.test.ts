import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { customerOwes, readJournal } from '../ledger';
import { InputError, noAddress, people, type People } from '../people';
import { emptyBusiness, saveBusinessDetails, startNew } from '../setup/store';
import { freshDb } from '../testing';
import { documents, type Documents, type LineInput } from '.';

// Quotations (spec section 6): issued, answered, revised and invoiced. They
// post nothing and are never debt.

// 27 November 2026, 14:00 in Harare (12:00 UTC).
let now = Date.UTC(2026, 10, 27, 12, 0, 0);
let db: Db;
let p: People;
let d: Documents;
let tendai: string;
let kitchen: string;

const days = (n: number) => n * 24 * 60 * 60 * 1000;

function problems(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError) return e.problems;
    throw e;
  }
  throw new Error('expected an InputError');
}

const labour: LineInput = { priceListItemId: null, description: 'Labour', unit: 'day', quantity: 4_000, unitPrice: 4_500 };
const cable: LineInput = { priceListItemId: null, description: 'Cable 2.5mm', unit: 'm', quantity: 100_000, unitPrice: 200 };

beforeEach(() => {
  now = Date.UTC(2026, 10, 27, 12, 0, 0);
  db = freshDb(() => now);
  startNew(db, '2026-11-27');
  saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services', phones: ['077 000 0000'] }, '2026-11-27');
  p = people(db, () => '2026-11-27');
  tendai = p.addCustomer({
    kind: 'person', name: 'Tendai Moyo', phones: ['077 123 4567'], whatsapp: '', email: '',
    address: { ...noAddress, city: 'Harare' }, taxNumber: '', firstSiteName: 'Home', note: '',
  });
  kitchen = p.addJob(tendai, { title: 'Kitchen rewiring', siteId: p.sites(tendai)[0]!.id });
  d = documents(db, () => now);
});

/** An Issued Quotation: labour 180.00 + cable 200.00 = 380.00. */
function issuedQuotation(more: (id: string) => void = () => {}): string {
  const id = d.newQuotation(tendai);
  d.setJob(id, kitchen);
  d.setLines(id, [labour, cable]);
  more(id);
  d.issue(id);
  return id;
}

describe('issuing a Quotation', () => {
  it('gives it the next QUO number, valid for 30 days, and posts nothing', () => {
    const id = issuedQuotation();
    const q = d.quotation(id);
    expect(q).toMatchObject({ number: 'QUO-0001', revision: 1, issueDate: '2026-11-27', validUntil: '2026-12-27', total: 38_000, status: 'issued' });
    expect(readJournal(db)).toEqual([]);
    expect(customerOwes(db, tendai)).toBe(0);
    expect(d.nextNumber('QUO')).toBe('QUO-0002');
    expect(d.nextNumber('INV')).toBe('INV-0001');
  });

  it('keeps a chosen valid-until date, Deposit asked and lead time, which lock at issue', () => {
    const id = issuedQuotation((x) => d.setTerms(x, { validUntil: '2027-01-15', depositAsked: 15_000, leadTime: '5 working days after the Deposit' }));
    expect(d.quotation(id)).toMatchObject({ validUntil: '2027-01-15', depositAsked: 15_000, leadTime: '5 working days after the Deposit' });
    expect(() => db.update('document', id, { lead_time: 'sooner' })).toThrow(/locked/);
    expect(() => db.update('document', id, { deposit_asked: 1 })).toThrow(/locked/);
  });

  it('refuses a valid-until date before the issue date and a Deposit asked above the Total', () => {
    const id = d.newQuotation(tendai);
    d.setJob(id, kitchen);
    d.setLines(id, [labour, cable]);
    expect(problems(() => d.setTerms(id, { validUntil: '2026-11-26', depositAsked: null, leadTime: '' }))).toHaveProperty('validUntil');
    d.setTerms(id, { validUntil: null, depositAsked: 38_001, leadTime: '' });
    expect(problems(() => d.issue(id))).toHaveProperty('depositAsked');
    expect(problems(() => d.setTerms(id, { validUntil: null, depositAsked: 0, leadTime: '' }))).toHaveProperty('depositAsked');
  });

  it('is Expired the day after valid-until, which locks nothing', () => {
    const id = issuedQuotation();
    now += days(31);
    expect(d.quotation(id).status).toBe('expired');
    expect(d.list({ filter: 'quotations' })[0]).toMatchObject({ title: 'QUO-0001', status: 'expired' });
  });
});

describe('answering a Quotation', () => {
  it('is marked Accepted or Declined with a date, and a Declined one can become Accepted', () => {
    const id = issuedQuotation();
    now += days(2);
    d.decline(id, '2026-11-28');
    expect(d.quotation(id)).toMatchObject({ status: 'declined', answer: { kind: 'declined', date: '2026-11-28' } });
    d.accept(id, '2026-11-29');
    expect(d.quotation(id)).toMatchObject({ status: 'accepted', answer: { kind: 'accepted', date: '2026-11-29' } });
    expect(readJournal(db)).toEqual([]);
  });

  it('refuses an answer dated before the issue date or after today', () => {
    const id = issuedQuotation();
    expect(problems(() => d.accept(id, '2026-11-26'))).toHaveProperty('date');
    expect(problems(() => d.accept(id, '2026-11-28'))).toHaveProperty('date');
  });

  it('warns, but allows, accepting after valid-until', () => {
    const id = issuedQuotation();
    expect(d.acceptWarning(id, '2026-12-27')).toBeNull();
    now += days(40);
    expect(d.acceptWarning(id, '2027-01-06')).toBe('It expired on 27 December 2026. Check the prices still hold.');
    d.accept(id, '2027-01-06');
    expect(d.quotation(id).status).toBe('accepted');
  });

  it('can have acceptance undone, back to Issued', () => {
    const id = issuedQuotation();
    d.accept(id, '2026-11-27');
    d.undoAccept(id);
    expect(d.quotation(id)).toMatchObject({ status: 'issued', answer: null });
  });

  it('is Cancelled with a reason, stays listed, and then takes no answer or Revision', () => {
    const id = issuedQuotation();
    expect(problems(() => d.cancelQuotation(id, ' '))).toHaveProperty('reason');
    d.cancelQuotation(id, 'Sent to the wrong Customer');
    expect(d.quotation(id)).toMatchObject({ status: 'cancelled', cancelled: { date: '2026-11-27', reason: 'Sent to the wrong Customer' } });
    expect(d.list({ filter: 'quotations' })[0]).toMatchObject({ title: 'QUO-0001', status: 'cancelled' });
    expect(problems(() => d.accept(id, '2026-11-27'))).toHaveProperty('quotation');
    expect(problems(() => d.revise(id))).toHaveProperty('quotation');
    expect(d.nextNumber('QUO')).toBe('QUO-0002');
  });

  it('keeps every answer as a fact that is never changed or deleted', () => {
    const id = issuedQuotation();
    d.accept(id, '2026-11-27');
    expect(() => db.run('DELETE FROM quotation_event')).toThrow(/never deleted/);
    expect(() => db.run("UPDATE quotation_event SET kind = 'declined'")).toThrow(/never changed/);
  });
});

describe('a Revision', () => {
  it('keeps the number as QUO-0001 Rev 2, supersedes the older one and takes no new number', () => {
    const first = issuedQuotation((x) => d.setTerms(x, { validUntil: null, depositAsked: 10_000, leadTime: '2 weeks' }));
    now += days(3);
    const rev = d.revise(first);
    expect(d.draft(rev)).toMatchObject({ revisesId: first, jobId: kitchen, depositAsked: 10_000, leadTime: '2 weeks' });
    expect(d.draft(rev).lines.map((l) => l.description)).toEqual(['Labour', 'Cable 2.5mm']);
    expect(d.revise(first)).toBe(rev);
    d.setLines(rev, [labour]);
    d.setTerms(rev, { validUntil: null, depositAsked: 5_000, leadTime: '2 weeks' });
    expect(d.issue(rev)).toBe('QUO-0001 Rev 2');
    expect(d.quotation(first)).toMatchObject({ status: 'superseded', supersededBy: 'QUO-0001 Rev 2' });
    expect(d.quotation(rev)).toMatchObject({ number: 'QUO-0001 Rev 2', revision: 2, total: 18_000, status: 'issued', validUntil: '2026-12-30' });
    expect(d.quotation(rev).revisions.map((r) => [r.number, r.status])).toEqual([
      ['QUO-0001', 'superseded'],
      ['QUO-0001 Rev 2', 'issued'],
    ]);
    expect(d.nextNumber('QUO')).toBe('QUO-0002');
  });

  it('only the latest can be accepted or revised', () => {
    const first = issuedQuotation();
    d.issue(d.revise(first));
    expect(problems(() => d.accept(first, '2026-11-27'))).toHaveProperty('quotation');
    expect(problems(() => d.revise(first))).toHaveProperty('quotation');
  });

  it('of an Accepted Quotation must be accepted again', () => {
    const first = issuedQuotation();
    d.accept(first, '2026-11-27');
    const rev = d.revise(first);
    d.issue(rev);
    expect(d.quotation(rev).status).toBe('issued');
  });

  it('is refused once an Invoice comes from the Accepted Quotation', () => {
    const first = issuedQuotation();
    d.accept(first, '2026-11-27');
    const draftRev = d.revise(first);
    d.issue(d.invoiceFrom(first));
    expect(problems(() => d.revise(first))).toHaveProperty('quotation');
    expect(problems(() => d.issue(draftRev))).toHaveProperty('quotation');
    expect(problems(() => d.undoAccept(first))).toHaveProperty('quotation');
    expect(problems(() => d.decline(first, '2026-11-27'))).toHaveProperty('quotation');
    expect(problems(() => d.cancelQuotation(first, 'mistake'))).toHaveProperty('quotation');
  });

  it('is for the same Customer', () => {
    const other = p.addCustomer({
      kind: 'person', name: 'Chipo Ndlovu', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: 'Shop', note: '',
    });
    const rev = d.revise(issuedQuotation());
    expect(problems(() => d.setCustomer(rev, other))).toHaveProperty('customer');
  });
});

describe('an Invoice from a Quotation', () => {
  it('asks for the Quotation to be accepted first', () => {
    const q = issuedQuotation();
    expect(problems(() => d.invoiceFrom(q))).toEqual({ accept: 'Mark QUO-0001 Accepted first, then make the Invoice.' });
  });

  it('copies its Customer, Job and lines to a Draft, and prints its number as the Quote ref.', () => {
    const q = issuedQuotation();
    d.accept(q, '2026-11-27');
    const inv = d.invoiceFrom(q);
    expect(d.draft(inv)).toMatchObject({ type: 'INV', customerId: tendai, jobId: kitchen, quotationId: q, discount: null });
    expect(d.draft(inv).lines.map((l) => [l.description, l.amount])).toEqual([['Labour', 18_000], ['Cable 2.5mm', 20_000]]);
    d.issue(inv);
    expect(d.printable(inv).quoteRef).toBe('QUO-0001');
    expect(customerOwes(db, tendai)).toBe(38_000);
    expect(d.quotation(q)).toMatchObject({ invoiced: 38_000, remaining: 0 });
  });

  it('can be one of several, showing what is invoiced and what remains, and warning on going over', () => {
    const q = issuedQuotation();
    d.accept(q, '2026-11-27');
    const a = d.invoiceFrom(q);
    d.setLines(a, [labour]);
    expect(d.fromQuotation(a)).toMatchObject({ number: 'QUO-0001', total: 38_000, invoicedBefore: 0, over: 0 });
    d.issue(a);
    expect(d.quotation(q)).toMatchObject({ invoiced: 18_000, remaining: 20_000 });
    const b = d.invoiceFrom(q);
    expect(d.fromQuotation(b)).toMatchObject({ invoicedBefore: 18_000, over: 18_000 });
    d.setLines(b, [cable]);
    expect(d.fromQuotation(b)!.over).toBe(0);
    d.issue(b);
    expect(d.quotation(q)).toMatchObject({ invoiced: 38_000, remaining: 0 });
    expect(d.quotation(q).invoices.map((i) => i.title)).toEqual(['INV-0002', 'INV-0001']);
  });

  it('takes its share of the Discount, the last taking the leftover cents, never more than the Discount', () => {
    // Subtotal 380.00, Discount 10.00: shares of 180.00 and 200.00 are 4.74 and 5.26.
    const q = issuedQuotation((x) => d.setDiscount(x, { kind: 'amount', cents: 1_000 }));
    d.accept(q, '2026-11-27');
    const a = d.invoiceFrom(q);
    expect(d.draft(a).totals.discount).toBe(1_000);
    d.setLines(a, [labour]);
    expect(d.draft(a).totals).toMatchObject({ subtotal: 18_000, discount: 474, total: 17_526 });
    d.issue(a);
    const b = d.invoiceFrom(q);
    d.setLines(b, [cable]);
    expect(d.draft(b).totals.discount).toBe(526);
    expect(problems(() => d.setDiscount(b, { kind: 'amount', cents: 527 }))).toEqual({
      discount: 'At most US$5.26 of the Quotation’s Discount is left.',
    });
    expect(problems(() => d.setDiscount(b, { kind: 'percent', tenths: 50 }))).toHaveProperty('discount');
    d.setDiscount(b, { kind: 'amount', cents: 300 });
    d.setLines(b, [cable, labour]);
    expect(d.draft(b).totals.discount).toBe(300);
    d.issue(b);
    const c = d.invoiceFrom(q);
    expect(d.draft(c).totals.discount).toBe(226);
  });

  it('is refused at issue if the Quotation is no longer Accepted', () => {
    const q = issuedQuotation();
    d.accept(q, '2026-11-27');
    const inv = d.invoiceFrom(q);
    d.undoAccept(q);
    expect(problems(() => d.issue(inv))).toHaveProperty('quotation');
  });
});

describe('a Quotation as printed', () => {
  it('prints its terms and Revision line', () => {
    const first = issuedQuotation((x) => d.setTerms(x, { validUntil: null, depositAsked: 15_000, leadTime: '5 working days' }));
    expect(d.printable(first).quotation).toEqual({
      revisionLine: '',
      validity: '30 days, until 27 Dec 2026',
      validUntil: '2026-12-27',
      deposit: '150.00 USD on acceptance',
      leadTime: '5 working days',
    });
    now += days(1);
    const rev = d.revise(first);
    expect(d.printable(rev)).toMatchObject({ number: null, quotation: { revisionLine: 'Revision 2 · replaces Rev 1 of 27 Nov 2026' } });
    d.issue(rev);
    expect(d.printable(rev)).toMatchObject({ number: 'QUO-0001 Rev 2', quotation: { validity: '30 days, until 28 Dec 2026' } });
  });
});
