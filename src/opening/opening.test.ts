import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT, accountBalance, checkLedger, customerBalances } from '../core';
import type { Db } from '../db';
import { documents, type Documents } from '../documents';
import { runChecks } from '../health/checks';
import { customerOwes, readJournal } from '../ledger';
import { payments, type Payments } from '../payments';
import { InputError, noAddress, people, type People } from '../people';
import { emptyBusiness, saveBusinessDetails, setStartDate, SetupError, startNew } from '../setup/store';
import { freshDb } from '../testing';
import { openingBalances, openingLine, receiptName, salesBeforeStart, setSalesBeforeStart, type Openings } from '.';

// The Start date is 1 September 2026; today is 27 November 2026.
const day = (d: string) => Date.parse(`${d}T12:00:00Z`);
let now = day('2026-11-27');
let db: Db;
let p: People;
let d: Documents;
let pay: Payments;
let ob: Openings;
let tendai: string;
let bathroom: string;

function problems(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError) return e.problems;
    throw e;
  }
  throw new Error('expected an InputError');
}

const owed = (amount: number, more: Partial<Parameters<Openings['add']>[0]> = {}) =>
  ob.add({ customerId: tendai, kind: 'owed', oldNumber: '1234', oldDate: '2026-03-03', amount, note: '', jobId: null, ...more });

const credit = (amount: number, note = 'Deposit for the roof') =>
  ob.add({ customerId: tendai, kind: 'credit', oldNumber: '', oldDate: null, amount, note, jobId: null });

beforeEach(() => {
  now = day('2026-11-27');
  db = freshDb(() => now);
  startNew(db, '2026-09-01');
  saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-09-01');
  p = people(db, () => '2026-11-27');
  tendai = p.addCustomer({
    kind: 'person', name: 'Tendai Moyo', phones: [], whatsapp: '', email: '',
    address: noAddress, taxNumber: '', firstSiteName: 'Home', note: '',
  });
  bathroom = p.addJob(tendai, { title: 'Bathroom tiling', siteId: p.sites(tendai)[0]!.id });
  d = documents(db, () => now);
  pay = payments(db, () => now);
  ob = openingBalances(db, () => now);
});

describe('an Opening balance item owed', () => {
  it('adds to what the Customer owes, dated at the Start date, and is never Sales', () => {
    const id = owed(45_000, { note: 'Balance', jobId: bathroom });
    expect(customerOwes(db, tendai)).toBe(45_000);
    expect(accountBalance(readJournal(db), ACCOUNT.sales)).toBe(0);
    expect(accountBalance(readJournal(db), ACCOUNT.openingBalances)).toBe(45_000);
    expect(readJournal(db)[0]).toMatchObject({ accountingDate: '2026-09-01', source: { kind: 'opening-balance', id } });
    expect(ob.items(tendai)).toMatchObject([
      { id, kind: 'owed', oldNumber: '1234', oldDate: '2026-03-03', amount: 45_000, left: 45_000, note: 'Balance', jobTitle: 'Bathroom tiling', date: '2026-09-01', status: 'open' },
    ]);
  });

  it('reads as the spec words it, never "before the app"', () => {
    owed(45_000);
    const [item] = ob.items(tendai);
    expect(openingLine(item!)).toBe('Opening balance · invoice 1234 · 3 March 2026 · US$450.00 owed');
    expect(receiptName(item!)).toBe('Opening balance (invoice 1234)');
    const none = ob.item(owed(1_000, { oldNumber: '', oldDate: null }));
    expect(openingLine(none)).toBe('Opening balance · US$10.00 owed');
    expect(receiptName(none)).toBe('Opening balance');
  });

  it('can be added at any time later and is still dated at the Start date', () => {
    now = day('2027-02-10');
    owed(5_000);
    expect(readJournal(db)[0]!.accountingDate).toBe('2026-09-01');
  });

  it('refuses what is not right, saying what to fix', () => {
    expect(problems(() => owed(0))).toMatchObject({ amount: 'Enter the amount, more than US$0.00.' });
    expect(problems(() => owed(100, { oldDate: '2026-09-02' }))).toMatchObject({
      oldDate: "The old invoice date can't be after your Start date, 1 September 2026.",
    });
    expect(problems(() => owed(100, { oldDate: '2026-02-30' }))).toHaveProperty('oldDate');
    const other = p.addCustomer({
      kind: 'person', name: 'Chipo Ndlovu', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const otherJob = p.addJob(other, { title: 'Roof', siteId: p.sites(other)[0]!.id });
    expect(problems(() => owed(100, { jobId: otherJob }))).toHaveProperty('jobId');
    expect(readJournal(db)).toEqual([]);
  });

  it('is paid like an Invoice, oldest first, and the Receipt names it', () => {
    const item = owed(45_000);
    now = day('2026-11-28');
    const inv = d.newInvoice(tendai);
    d.setJob(inv, bathroom);
    d.setLines(inv, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1_000, unitPrice: 10_000 }]);
    d.issue(inv);
    expect(pay.owing(tendai).map((o) => [o.number, o.owed, o.kind])).toEqual([
      ['Opening balance (invoice 1234)', 45_000, 'opening'],
      ['INV-0001', 10_000, 'invoice'],
    ]);
    const [rec] = pay.record({
      customerId: tendai, amount: 50_000, dateReceived: '2026-11-28', method: 'cash', otherDescription: '',
      parts: [{ invoiceId: item, amount: 45_000 }, { invoiceId: inv, amount: 5_000 }], separate: false,
    });
    expect(pay.receipt(rec!).lines.map((l) => [l.appliedTo, l.amount, l.balanceLeft])).toEqual([
      ['Opening balance (invoice 1234)', 45_000, 0],
      ['INV-0001', 5_000, 5_000],
    ]);
    expect(db.get('SELECT opening_balance_id FROM receipt_line WHERE receipt_id = ? AND position = 1', [rec!])?.opening_balance_id).toBe(item);
    expect(ob.item(item)).toMatchObject({ left: 0, status: 'paid' });
    expect(customerOwes(db, tendai)).toBe(5_000);
    expect(accountBalance(readJournal(db), ACCOUNT.sales)).toBe(10_000);
    expect(pay.owing(tendai).map((o) => o.number)).toEqual(['INV-0001']);
  });

  it('is never paid beyond what it still owes', () => {
    const item = owed(1_000);
    expect(
      problems(() =>
        pay.record({
          customerId: tendai, amount: 2_000, dateReceived: '2026-11-27', method: 'cash', otherDescription: '',
          parts: [{ invoiceId: item, amount: 2_000 }], separate: false,
        }),
      ),
    ).toHaveProperty('parts');
  });
});

describe('an Opening balance of Credit held', () => {
  it('is Credit held for the Customer, with a note, not money received', () => {
    credit(20_000);
    expect(customerBalances(readJournal(db), tendai)).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 20_000 });
    expect(accountBalance(readJournal(db), ACCOUNT.cash)).toBe(0);
    const [item] = ob.items(tendai);
    expect(openingLine(item!)).toBe('Opening balance · US$200.00 held for them · Deposit for the roof');
    expect(problems(() => credit(100, ' '))).toHaveProperty('note');
  });

  it("becomes an accepted re-created Quotation's Deposit", () => {
    const item = credit(20_000);
    now = day('2026-11-28');
    const q = d.newQuotation(tendai);
    d.setJob(q, bathroom);
    d.setLines(q, [{ priceListItemId: null, description: 'Roof', unit: '', quantity: 1_000, unitPrice: 90_000 }]);
    d.issue(q);
    expect(ob.depositQuotations(item)).toEqual([]);
    d.accept(q, '2026-11-28');
    expect(ob.depositQuotations(item).map((x) => x.number)).toEqual(['QUO-0001']);
    ob.makeDeposit(item, q);
    expect(customerBalances(readJournal(db), tendai)).toEqual({ owes: 0, depositsHeld: 20_000, creditHeld: 0 });
    expect(db.get("SELECT from_kind, to_kind, to_id, amount FROM allocation WHERE from_id = ?", [item])).toMatchObject({
      from_kind: 'opening-credit', to_kind: 'quotation', to_id: q, amount: 20_000,
    });
    expect(ob.item(item)).toMatchObject({ left: 0, status: 'used', depositOn: 'QUO-0001' });
    expect(() => ob.makeDeposit(item, q)).toThrow(InputError);
  });
});

describe('cancelling an Opening balance item', () => {
  it('reverses it on the day, keeps it with its reason, and lets it be entered again', () => {
    const item = owed(45_000);
    now = day('2026-12-02');
    expect(problems(() => ob.cancel(item, ' '))).toEqual({ reason: 'Give a reason for cancelling.' });
    ob.cancel(item, 'Wrong amount');
    expect(customerOwes(db, tendai)).toBe(0);
    expect(readJournal(db).at(-1)).toMatchObject({ accountingDate: '2026-12-02', reverses: readJournal(db)[0]!.id });
    expect(ob.item(item)).toMatchObject({ status: 'cancelled', cancelReason: 'Wrong amount', cancelledOn: '2026-12-02', left: 0 });
    expect(pay.owing(tendai)).toEqual([]);
    expect(() => ob.cancel(item, 'Again')).toThrow(InputError);
    owed(40_000);
    expect(customerOwes(db, tendai)).toBe(40_000);
    expect(() => db.run('DELETE FROM opening_balance_item')).toThrow();
    expect(() => db.run('UPDATE opening_balance_item SET amount = 1')).toThrow();
  });

  it('is refused while a Payment is applied to it', () => {
    const item = owed(45_000);
    pay.record({
      customerId: tendai, amount: 1_000, dateReceived: '2026-11-27', method: 'cash', otherDescription: '',
      parts: [{ invoiceId: item, amount: 1_000 }], separate: false,
    });
    expect(problems(() => ob.cancel(item, 'Wrong'))).toEqual({ reason: 'A Payment was applied to it. Cancel that Receipt first.' });
  });

  it('of Credit is refused once the Credit is used', () => {
    const item = credit(20_000);
    const q = d.newQuotation(tendai);
    d.setJob(q, bathroom);
    d.setLines(q, [{ priceListItemId: null, description: 'Roof', unit: '', quantity: 1_000, unitPrice: 90_000 }]);
    d.issue(q);
    d.accept(q, '2026-11-27');
    ob.makeDeposit(item, q);
    expect(problems(() => ob.cancel(item, 'Wrong'))).toEqual({ reason: 'This Credit has been used. Undo that first.' });
    const other = credit(5_000);
    ob.cancel(other, 'Entered twice');
    expect(customerBalances(readJournal(db), tendai).creditHeld).toBe(0);
  });
});

describe('the Start date and Opening balances', () => {
  it('can no longer move once an Opening balance is dated on it', () => {
    const item = owed(100);
    expect(() => setStartDate(db, '2026-08-01', '2026-11-27')).toThrow(SetupError);
    ob.cancel(item, 'Wrong');
    setStartDate(db, '2026-08-01', '2026-11-27');
  });
});

describe('the checks', () => {
  it('find the ledger in step with the Opening balances', () => {
    owed(45_000);
    credit(2_000);
    expect(checkLedger(readJournal(db))).toEqual([]);
    expect(runChecks(db).filter((r) => r.outcome === 'failed')).toEqual([]);
  });
});

describe('sales before the Start date', () => {
  it('are one total for each of the 12 months before it, blank until entered, and post nothing', () => {
    const months = salesBeforeStart(db);
    expect(months.map((m) => m.month)).toEqual([
      '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
    expect(months.every((m) => m.amount === null)).toBe(true);
    setSalesBeforeStart(db, { '2026-08': 220_000, '2026-07': 0 });
    setSalesBeforeStart(db, { '2026-08': 230_000, '2026-06': null });
    expect(salesBeforeStart(db).slice(-3)).toEqual([
      { month: '2026-06', amount: null },
      { month: '2026-07', amount: 0 },
      { month: '2026-08', amount: 230_000 },
    ]);
    expect(readJournal(db)).toEqual([]);
  });

  it('refuse a month outside the 12, or a negative amount', () => {
    expect(() => setSalesBeforeStart(db, { '2026-09': 100 })).toThrow(InputError);
    expect(() => setSalesBeforeStart(db, { '2026-08': -1 })).toThrow(InputError);
  });
});
