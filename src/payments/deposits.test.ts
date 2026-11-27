import { beforeEach, describe, expect, it } from 'vitest';
import { customerBalances } from '../core';
import type { Db } from '../db';
import { documents, type Documents } from '../documents';
import { postEntry, readJournal } from '../ledger';
import { runChecks } from '../health/checks';
import { InputError, noAddress, people, type People } from '../people';
import { emptyBusiness, saveBusinessDetails, startNew } from '../setup/store';
import { freshDb } from '../testing';
import { payments, type PaymentInput, type Payments } from '.';

// Deposits (spec sections 5, 6 and 9): money paid against an accepted
// Quotation, held for the Customer until an Invoice from it is issued.

const day = (d: string) => Date.parse(`${d}T12:00:00Z`);
let now = day('2026-11-27');
let db: Db;
let p: People;
let d: Documents;
let pay: Payments;
let tendai: string;
let kitchen: string;

function problems(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError) return e.problems;
    throw e;
  }
  throw new Error('expected an InputError');
}

/** An Issued and Accepted Quotation of `cents` for the kitchen, Deposit asked `asked`. */
function acceptedQuotation(cents: number, asked: number | null = null, on = '2026-11-02'): string {
  now = day(on);
  const id = d.newQuotation(tendai);
  d.setJob(id, kitchen);
  d.setLines(id, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1_000, unitPrice: cents }]);
  d.setTerms(id, { validUntil: null, depositAsked: asked, leadTime: '' });
  d.issue(id);
  d.accept(id, on);
  return id;
}

const cash = (amount: number, parts: PaymentInput['parts'], more: Partial<PaymentInput> = {}): PaymentInput => ({
  customerId: tendai,
  amount,
  dateReceived: todayText(),
  method: 'cash',
  otherDescription: '',
  parts,
  separate: false,
  ...more,
});
const todayText = () => new Date(now).toISOString().slice(0, 10);
const balances = () => customerBalances(readJournal(db), tendai);

beforeEach(() => {
  now = day('2026-11-27');
  db = freshDb(() => now);
  startNew(db, '2026-01-01');
  saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-01-01');
  p = people(db, () => todayText());
  tendai = p.addCustomer({
    kind: 'person', name: 'Tendai Moyo', phones: ['077 123 4567'], whatsapp: '', email: '',
    address: { ...noAddress, city: 'Harare' }, taxNumber: '', firstSiteName: 'Home', note: '',
  });
  kitchen = p.addJob(tendai, { title: 'Kitchen rewiring', siteId: p.sites(tendai)[0]!.id });
  d = documents(db, () => now);
  pay = payments(db, () => now);
});

describe('a Deposit on an accepted Quotation', () => {
  it('is offered for the Customer’s accepted Quotations, with what is asked and what is held', () => {
    const q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-12');
    expect(pay.deposits(tendai)).toEqual([
      { quotationId: q, number: 'QUO-0001', jobTitle: 'Kitchen rewiring', total: 100_000, asked: 50_000, held: 0, room: 100_000, suggested: 50_000 },
    ]);
  });

  it('is recorded by a Payment, held in Deposits held, and printed on its Receipt', () => {
    const q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-12');
    const [receiptId] = pay.record(cash(50_000, [{ quotationId: q, amount: 50_000 }]));
    expect(balances()).toEqual({ owes: 0, depositsHeld: 50_000, creditHeld: 0 });
    const r = pay.receipt(receiptId!);
    expect(r).toMatchObject({ number: 'REC-0001', kind: 'money', amount: 50_000 });
    expect(r.lines.map((l) => [l.appliedTo, l.jobTitle, l.total, l.amount, l.balanceLeft])).toEqual([
      ['Deposit on QUO-0001', 'Kitchen rewiring', 100_000, 50_000, 50_000],
    ]);
    expect(pay.deposits(tendai)[0]).toMatchObject({ held: 50_000, room: 50_000, suggested: 0 });
  });

  it('can share one Payment with an Invoice', () => {
    const q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-05');
    const inv = d.newInvoice(tendai);
    d.setJob(inv, kitchen);
    d.setLines(inv, [{ priceListItemId: null, description: 'Call-out', unit: '', quantity: 1_000, unitPrice: 2_000 }]);
    d.issue(inv);
    now = day('2026-11-12');
    pay.record(cash(52_000, [{ invoiceId: inv, amount: 2_000 }, { quotationId: q, amount: 50_000 }]));
    expect(balances()).toEqual({ owes: 0, depositsHeld: 50_000, creditHeld: 0 });
    const entry = readJournal(db).at(-1)!;
    expect(entry.lines).toEqual([
      { account: '1010', side: 'debit', amount: 52_000 },
      { account: '1100', side: 'credit', amount: 2_000, customerId: tendai },
      { account: '2100', side: 'credit', amount: 50_000, customerId: tendai },
    ]);
  });

  it('is refused on a Quotation that is not Accepted, or for more than is left of its Total', () => {
    const q = acceptedQuotation(100_000);
    now = day('2026-11-12');
    expect(problems(() => pay.record(cash(100_001, [{ quotationId: q, amount: 100_001 }])))).toMatchObject({
      parts: 'A Deposit on QUO-0001 can be at most US$1,000.00.',
    });
    d.undoAccept(q);
    expect(problems(() => pay.record(cash(1_000, [{ quotationId: q, amount: 1_000 }])))).toMatchObject({
      parts: 'QUO-0001 is not Accepted, so it can take no Deposit.',
    });
    expect(balances().depositsHeld).toBe(0);
  });
});

/** A Draft Invoice from the Quotation, its lines cut to `cents` when given. */
function draftFrom(q: string, cents?: number): string {
  const id = d.invoiceFrom(q);
  if (cents !== undefined)
    d.setLines(id, [{ priceListItemId: null, description: 'Labour, first part', unit: '', quantity: 1_000, unitPrice: cents }]);
  return id;
}

describe('issuing an Invoice from a Quotation with a Deposit', () => {
  let q: string;
  beforeEach(() => {
    q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-12');
    pay.record(cash(30_000, [{ quotationId: q, amount: 30_000 }]));
    now = day('2026-11-14');
    pay.record(cash(20_000, [{ quotationId: q, amount: 20_000 }], { method: 'ecocash' }));
    now = day('2026-11-27');
  });

  it('applies the Deposit, up to the Invoice total, with a "Deposit applied" Receipt naming the Receipts it was paid on', () => {
    const inv = draftFrom(q);
    expect(d.fromQuotation(inv)).toMatchObject({ depositHeld: 50_000 });
    d.issue(inv);
    expect(balances()).toEqual({ owes: 50_000, depositsHeld: 0, creditHeld: 0 });
    expect(d.issued(inv).status).toBe('part-paid');
    const applied = d.list({ filter: 'receipts' })[0]!;
    expect(applied).toMatchObject({ title: 'REC-0003', status: 'applied', total: 50_000 });
    const r = pay.receipt(applied.id);
    expect(r).toMatchObject({ kind: 'deposit-applied', method: '', methodCode: null, amount: 50_000 });
    expect(r.appliedFrom).toEqual([
      { number: 'REC-0001', dateReceived: '2026-11-12' },
      { number: 'REC-0002', dateReceived: '2026-11-14' },
    ]);
    expect(r.lines.map((l) => [l.appliedTo, l.total, l.amount, l.balanceLeft])).toEqual([['INV-0001', 100_000, 50_000, 50_000]]);
    expect(pay.printable(applied.id).applied).toEqual({
      title: 'Deposit applied',
      notice: 'No new money was received. This applies the Deposit paid on REC-0001 (12 Nov 2026) and REC-0002 (14 Nov 2026) to the Invoice below.',
    });
    const entry = readJournal(db).at(-1)!;
    expect(entry.lines).toEqual([
      { account: '2100', side: 'debit', amount: 50_000, customerId: tendai },
      { account: '1100', side: 'credit', amount: 50_000, customerId: tendai },
    ]);
  });

  it('applies no more than the Invoice total; the rest waits for the next Invoice', () => {
    const first = draftFrom(q, 40_000);
    d.issue(first);
    expect(d.issued(first).status).toBe('paid');
    expect(balances()).toEqual({ owes: 0, depositsHeld: 10_000, creditHeld: 0 });
    const second = draftFrom(q, 60_000);
    d.issue(second);
    expect(balances()).toEqual({ owes: 50_000, depositsHeld: 0, creditHeld: 0 });
    const last = pay.receipt(d.list({ filter: 'receipts' })[0]!.id);
    expect(last.appliedFrom.map((x) => x.number)).toEqual(['REC-0002']);
  });

  it('applies less when the User reduces it, never more than is held or than the Invoice total', () => {
    const inv = draftFrom(q, 40_000);
    expect(problems(() => d.issue(inv, { deposit: 40_001 }))).toEqual({ deposit: 'Apply at most US$400.00 of the Deposit.' });
    expect(problems(() => d.issue(inv, { deposit: -1 }))).toEqual({ deposit: 'Apply at most US$400.00 of the Deposit.' });
    d.issue(inv, { deposit: 15_000 });
    expect(balances()).toEqual({ owes: 25_000, depositsHeld: 35_000, creditHeld: 0 });
  });

  it('applies nothing, and issues no Receipt, when the User sets it to zero', () => {
    const inv = draftFrom(q);
    d.issue(inv, { deposit: 0 });
    expect(balances()).toEqual({ owes: 100_000, depositsHeld: 50_000, creditHeld: 0 });
    expect(d.list({ filter: 'receipts' })).toHaveLength(2);
  });

  it('keeps the Deposit with the Quotation through a Revision', () => {
    // Fresh Quotation, revised before invoicing: the Deposit paid on Rev 1 applies to the Invoice from Rev 2.
    const q2 = acceptedQuotation(20_000, null, '2026-11-20');
    now = day('2026-11-21');
    pay.record(cash(5_000, [{ quotationId: q2, amount: 5_000 }]));
    const rev = d.revise(q2);
    d.issue(rev);
    d.accept(rev, '2026-11-21');
    expect(pay.deposits(tendai).find((x) => x.quotationId === rev)).toMatchObject({ held: 5_000 });
    const inv = draftFrom(rev);
    d.issue(inv);
    expect(d.issued(inv).status).toBe('part-paid');
    expect(balances().depositsHeld).toBe(50_000);
  });

  it('prints "Deposit applied (REC-…)" then Balance due on the Invoice', () => {
    const inv = draftFrom(q, 80_000);
    d.issue(inv);
    expect(d.printable(inv).depositsApplied).toEqual([{ label: 'Deposit applied (REC-0003)', amount: 50_000 }]);
  });
});

describe('a Deposit no longer wanted on its Quotation', () => {
  let q: string;
  beforeEach(() => {
    q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-12');
    pay.record(cash(30_000, [{ quotationId: q, amount: 30_000 }]));
    now = day('2026-11-27');
  });

  it.each([
    ['taking back Accepted', () => d.undoAccept(q)],
    ['declining it', () => d.decline(q, '2026-11-27')],
    ['cancelling it', () => d.cancelQuotation(q, 'Customer went elsewhere')],
  ])('moves to Credit first when %s', (_, act) => {
    expect(d.quotation(q).depositHeld).toBe(30_000);
    act();
    expect(balances()).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 30_000 });
    expect(d.quotation(q).depositHeld).toBe(0);
    const entry = readJournal(db).at(-1)!;
    expect(entry.accountingDate).toBe('2026-11-27');
    expect(entry.lines).toEqual([
      { account: '2100', side: 'debit', amount: 30_000, customerId: tendai },
      { account: '2200', side: 'credit', amount: 30_000, customerId: tendai },
    ]);
  });

  it('is listed on its Job and can be moved to Credit when the Job closes', () => {
    expect(pay.depositsOnJob(kitchen)).toEqual([{ quotationId: q, number: 'QUO-0001', held: 30_000 }]);
    expect(pay.moveToCredit(q)).toBe(30_000);
    expect(pay.depositsOnJob(kitchen)).toEqual([]);
    expect(balances()).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 30_000 });
    expect(pay.moveToCredit(q)).toBe(0);
  });
});

describe('the checks on open for Deposits', () => {
  const rule = (n: number) => runChecks(db).find((r) => r.name.startsWith(`Rule ${n}:`))!;

  it('pass when Deposits are paid, applied and moved to Credit', () => {
    const q = acceptedQuotation(100_000, 50_000);
    now = day('2026-11-12');
    pay.record(cash(50_000, [{ quotationId: q, amount: 50_000 }]));
    now = day('2026-11-27');
    d.issue(draftFrom(q, 30_000));
    pay.moveToCredit(q);
    for (const n of [3, 5, 6]) expect(rule(n)).toMatchObject({ outcome: 'passed', problems: [] });
  });

  it('Rule 3 fails, naming the Customer, when the ledger holds a Deposit no Quotation has', () => {
    const q = acceptedQuotation(100_000);
    now = day('2026-11-12');
    pay.record(cash(10_000, [{ quotationId: q, amount: 10_000 }]));
    const lot = db.get("SELECT id, journal_entry_id FROM allocation WHERE to_kind = 'quotation'")!;
    db.insert('allocation', {
      journal_entry_id: String(lot.journal_entry_id), from_kind: 'deposit', from_id: String(lot.id), to_kind: 'credit', to_id: tendai, amount: 1,
    });
    expect(rule(3)).toMatchObject({
      outcome: 'failed',
      problems: [`Customer ${tendai}: Deposits held in the ledger do not agree with the Deposits on their Quotations.`],
    });
  });

  it('Rule 6 fails when a "Deposit applied" Receipt brings money in', () => {
    const q = acceptedQuotation(100_000);
    now = day('2026-11-12');
    pay.record(cash(10_000, [{ quotationId: q, amount: 10_000 }]));
    now = day('2026-11-27');
    d.issue(draftFrom(q));
    const applied = d.list({ filter: 'receipts' }).find((x) => x.status === 'applied')!;
    postEntry(db, {
      accountingDate: '2026-11-27', recordedAt: '2026-11-27T12:00:00Z', source: { kind: 'receipt', id: applied.id },
      lines: [{ account: '1010', side: 'debit', amount: 1 }, { account: '4000', side: 'credit', amount: 1 }],
    });
    expect(rule(6).outcome).toBe('failed');
  });
});
