import { beforeEach, describe, expect, it } from 'vitest';
import { customerBalances } from '../core';
import type { Db } from '../db';
import { documents, type Documents } from '../documents';
import { runChecks } from '../health/checks';
import { postEntry, readJournal } from '../ledger';
import { openingBalances } from '../opening';
import { InputError, noAddress, people, type People } from '../people';
import { emptyBusiness, saveBusinessDetails, startNew } from '../setup/store';
import { freshDb } from '../testing';
import { payments, type PaymentInput, type Payments, type RefundInput } from '.';

// Credit and Refunds (spec section 6): money more than what a Payment pays
// becomes Credit once the User confirms it; Credit is applied only when the
// User agrees, with a "Credit applied" Receipt; unused Deposits and Credit
// can be refunded, up to what is held, as a Refund REF-0001.

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

const todayText = () => new Date(now).toISOString().slice(0, 10);
const balances = () => customerBalances(readJournal(db), tendai);

function invoice(cents: number, on = todayText()): string {
  now = day(on);
  const id = d.newInvoice(tendai);
  d.setJob(id, kitchen);
  d.setLines(id, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1_000, unitPrice: cents }]);
  d.issue(id);
  return id;
}

function acceptedQuotation(cents: number, on = todayText()): string {
  now = day(on);
  const id = d.newQuotation(tendai);
  d.setJob(id, kitchen);
  d.setLines(id, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1_000, unitPrice: cents }]);
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

const refundOf = (amount: number, more: Partial<RefundInput> = {}): RefundInput => ({
  customerId: tendai,
  from: { kind: 'credit' },
  amount,
  date: todayText(),
  method: 'ecocash',
  otherDescription: '',
  reason: 'Job dropped before work started',
  ...more,
});

const failed = () => runChecks(db).filter((r) => r.outcome === 'failed');

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

describe('an overpayment', () => {
  it('is refused until the User confirms it is kept as Credit', () => {
    const inv = invoice(10_000, '2026-11-02');
    expect(problems(() => pay.record(cash(15_000, [{ invoiceId: inv, amount: 10_000 }]))).amount).toBe(
      'US$50.00 of this is more than the ticked Invoices owe. Lower the amount, tick another Invoice, or keep it as Credit.',
    );
  });

  it('becomes Credit for the Customer, on the same Receipt, after confirmation', () => {
    const inv = invoice(10_000, '2026-11-02');
    now = day('2026-11-20');
    const [rec] = pay.record(cash(15_000, [{ invoiceId: inv, amount: 10_000 }], { toCredit: 5_000 }));
    expect(pay.creditHeld(tendai)).toBe(5_000);
    expect(balances()).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 5_000 });
    const r = pay.receipt(rec!);
    expect([r.number, r.kind, r.amount]).toEqual(['REC-0001', 'money', 15_000]);
    expect(r.lines.map((l) => [l.appliedTo, l.amount, l.balanceLeft])).toEqual([
      ['INV-0001', 10_000, 0],
      ['Kept as Credit', 5_000, 0],
    ]);
    expect(failed()).toEqual([]);
  });

  it('can be the whole Payment when nothing is owed', () => {
    const [rec] = pay.record(cash(2_500, [], { toCredit: 2_500 }));
    expect(pay.creditHeld(tendai)).toBe(2_500);
    expect(pay.receipt(rec!).lines.map((l) => l.appliedTo)).toEqual(['Kept as Credit']);
    expect(failed()).toEqual([]);
  });

  it('goes on the last Receipt when Separate receipts is chosen', () => {
    const a = invoice(1_000, '2026-11-02');
    const b = invoice(2_000, '2026-11-03');
    const ids = pay.record(cash(4_000, [{ invoiceId: a, amount: 1_000 }, { invoiceId: b, amount: 2_000 }], { separate: true, toCredit: 1_000 }));
    expect(ids.map((id) => pay.receipt(id).amount)).toEqual([1_000, 3_000]);
    expect(pay.creditHeld(tendai)).toBe(1_000);
    expect(failed()).toEqual([]);
  });

  it('must add up with the parts to the amount received', () => {
    const inv = invoice(10_000, '2026-11-02');
    expect(problems(() => pay.record(cash(15_000, [{ invoiceId: inv, amount: 10_000 }], { toCredit: 6_000 }))).amount).toBe(
      'The amounts on the Invoices and Credit add up to US$160.00, more than the US$150.00 received.',
    );
  });
});

describe('Credit applied to an Invoice', () => {
  it('is suggested, up to what is held and what the Invoice owes', () => {
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    const inv = invoice(3_000);
    expect(pay.creditFor(inv)).toEqual({ held: 5_000, most: 3_000 });
    expect(pay.creditFor(invoice(9_000))).toEqual({ held: 5_000, most: 5_000 });
  });

  it('issues a "Credit applied" Receipt naming the original Receipt, with no new money', () => {
    now = day('2026-11-12');
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    now = day('2026-11-27');
    const inv = invoice(3_000);
    const rec = pay.applyCredit(inv, 2_000);
    const r = pay.receipt(rec);
    expect([r.number, r.kind, r.amount, r.method, r.methodCode]).toEqual(['REC-0002', 'credit-applied', 2_000, '', null]);
    expect(r.appliedFrom).toEqual([{ number: 'REC-0001', dateReceived: '2026-11-12' }]);
    const printed = pay.printable(rec);
    expect(printed.applied).toEqual({
      title: 'Credit applied',
      notice: 'No new money was received. This applies Credit from REC-0001 (12 Nov 2026) to the Invoice below.',
    });
    expect(r.lines.map((l) => [l.appliedTo, l.amount, l.balanceLeft])).toEqual([['INV-0001', 2_000, 1_000]]);
    expect(pay.creditHeld(tendai)).toBe(3_000);
    expect(balances()).toEqual({ owes: 1_000, depositsHeld: 0, creditHeld: 3_000 });
    expect(d.list().find((x) => x.id === rec)!.status).toBe('applied');
    expect(d.printable(inv).depositsApplied).toEqual([{ label: 'Credit applied (REC-0002)', amount: 2_000 }]);
    expect(failed()).toEqual([]);
  });

  it('takes the oldest Credit first, naming each Receipt it came from', () => {
    now = day('2026-11-10');
    pay.record(cash(1_000, [], { toCredit: 1_000 }));
    now = day('2026-11-11');
    pay.record(cash(1_000, [], { toCredit: 1_000 }));
    now = day('2026-11-27');
    const rec = pay.applyCredit(invoice(5_000), 1_500);
    expect(pay.receipt(rec).appliedFrom.map((x) => x.number)).toEqual(['REC-0001', 'REC-0002']);
  });

  it('can be a Deposit moved to Credit, naming the Receipt the Deposit was paid on', () => {
    const q = acceptedQuotation(10_000, '2026-11-02');
    now = day('2026-11-05');
    pay.record(cash(4_000, [{ quotationId: q, amount: 4_000 }]));
    now = day('2026-11-20');
    pay.moveToCredit(q);
    const rec = pay.applyCredit(invoice(1_000), 1_000);
    expect(pay.receipt(rec).appliedFrom).toEqual([{ number: 'REC-0001', dateReceived: '2026-11-05' }]);
    expect(pay.creditHeld(tendai)).toBe(3_000);
    expect(failed()).toEqual([]);
  });

  it('is refused above what is held or what the Invoice owes, and saves nothing', () => {
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    const inv = invoice(3_000);
    expect(problems(() => pay.applyCredit(inv, 4_000)).amount).toBe('Apply at most US$30.00 of Credit.');
    expect(problems(() => pay.applyCredit(inv, 0)).amount).toBe('Apply more than US$0.00 of Credit.');
    expect(pay.creditHeld(tendai)).toBe(5_000);
  });

  it('is applied to what they owe oldest first, one Receipt per Invoice, when the User agrees', () => {
    const a = invoice(1_000, '2026-11-02');
    const b = invoice(3_000, '2026-11-03');
    now = day('2026-11-10');
    pay.record(cash(2_500, [], { toCredit: 2_500 }));
    const ids = pay.applyCreditToOwing(tendai);
    expect(ids.map((id) => pay.receipt(id).lines[0]!.appliedTo)).toEqual(['INV-0001', 'INV-0002']);
    expect(pay.owing(tendai).map((o) => [o.id, o.owed])).toEqual([[b, 1_500]]);
    expect(pay.creditHeld(tendai)).toBe(0);
    expect(a).toBeTruthy();
  });
});

describe('the checks on open', () => {
  const rule = (n: number) => runChecks(db).find((r) => r.name.startsWith(`Rule ${n}:`))!;

  it('Rule 1 and Rule 3 pass with Credit kept, applied and refunded', () => {
    now = day('2026-11-12');
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    now = day('2026-11-27');
    pay.applyCredit(invoice(1_000), 1_000);
    pay.refund(refundOf(1_500));
    expect(rule(1)).toMatchObject({ outcome: 'passed', problems: [] });
    expect(rule(3)).toMatchObject({ outcome: 'passed', problems: [] });
  });

  it('Rule 3 fails, naming the Customer, when the ledger holds Credit their records do not', () => {
    const [rec] = pay.record(cash(5_000, [], { toCredit: 5_000 }));
    const lot = db.get("SELECT id, journal_entry_id FROM allocation WHERE to_kind = 'credit'")!;
    db.insert('allocation', {
      journal_entry_id: String(lot.journal_entry_id), from_kind: 'credit', from_id: String(lot.id), to_kind: 'refund', to_id: rec!, amount: 1,
    });
    expect(rule(3)).toMatchObject({
      outcome: 'failed',
      problems: [`Customer ${tendai}: Credit held in the ledger does not agree with the Credit in their records.`],
    });
  });

  it('Rule 1 fails, naming the Refund, when what it used does not add up to it', () => {
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    const ref = pay.refund(refundOf(1_000));
    const lot = db.get("SELECT id, journal_entry_id FROM allocation WHERE to_kind = 'credit'")!;
    db.insert('allocation', {
      journal_entry_id: String(lot.journal_entry_id), from_kind: 'credit', from_id: String(lot.id), to_kind: 'refund', to_id: ref, amount: 1,
    });
    const refundId = String(db.get('SELECT id FROM refund')!.id);
    expect(rule(1)).toMatchObject({ outcome: 'failed', problems: [`Refund ${refundId}: what it paid back from does not add up to it.`] });
  });

  it('Rule 1 fails when the money accounts do not agree with Payments less Refunds', () => {
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    postEntry(db, {
      accountingDate: '2026-11-27', recordedAt: '2026-11-27T12:00:00Z', source: { kind: 'test', id: 'x' },
      lines: [{ account: '1010', side: 'debit', amount: 1 }, { account: '3000', side: 'credit', amount: 1 }],
    });
    expect(rule(1).problems).toContain('The money accounts in the ledger do not agree with Payments less Refunds.');
  });
});

describe('a Refund', () => {
  it('returns Credit as REF-0001: amount, date, method and reason, posting Credit held / the money account', () => {
    now = day('2026-11-12');
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    now = day('2026-11-27');
    const ref = pay.refund(refundOf(2_000));
    const r = pay.refundDoc(ref);
    expect([r.number, r.amount, r.date, r.method, r.reason, r.refundOf]).toEqual([
      'REF-0001', 2_000, '2026-11-27', 'EcoCash', 'Job dropped before work started', 'Unused Credit, from REC-0001 (12 Nov 2026)',
    ]);
    expect(pay.creditHeld(tendai)).toBe(3_000);
    expect(balances().creditHeld).toBe(3_000);
    const lines = readJournal(db).at(-1)!.lines;
    expect(lines).toEqual([
      { account: '2200', side: 'debit', amount: 2_000, customerId: tendai },
      { account: '1030', side: 'credit', amount: 2_000 },
    ]);
    expect(d.list().find((x) => x.id === ref)).toMatchObject({ title: 'REF-0001', status: 'refunded', total: 2_000 });
    expect(failed()).toEqual([]);
  });

  it('returns an unused Deposit on a Quotation, which then holds less', () => {
    const q = acceptedQuotation(10_000, '2026-10-01');
    now = day('2026-10-02');
    pay.record(cash(4_000, [{ quotationId: q, amount: 4_000 }]));
    now = day('2026-11-27');
    expect(pay.refundSources(tendai)).toEqual([{ kind: 'deposit', quotationId: q, title: 'Deposit on QUO-0001', held: 4_000, method: 'cash' }]);
    const ref = pay.refund(refundOf(4_000, { from: { kind: 'deposit', quotationId: q }, method: 'cash' }));
    expect(pay.refundDoc(ref).refundOf).toBe('Unused Deposit on QUO-0001, paid on REC-0001 (2 Oct 2026)');
    expect(pay.deposits(tendai)[0]!.held).toBe(0);
    expect(balances().depositsHeld).toBe(0);
    expect(pay.refundSources(tendai)).toEqual([]);
    expect(failed()).toEqual([]);
  });

  it('is refused above what is held, without a reason, in the future, or before the money came in', () => {
    now = day('2026-11-12');
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    now = day('2026-11-27');
    const all = problems(() => pay.refund(refundOf(6_000, { reason: ' ', date: '2026-11-28' })));
    expect(all).toMatchObject({
      amount: 'Refund at most US$50.00, the Credit held.',
      reason: 'Say why the money is paid back.',
      date: "The Refund date can't be after today.",
    });
    expect(problems(() => pay.refund(refundOf(1_000, { date: '2026-11-11' }))).date).toBe(
      "The money came in on 12 November 2026; the Refund can't be before that.",
    );
    expect(pay.creditHeld(tendai)).toBe(5_000);
    expect(pay.checkRefund(refundOf(1_000)).number).toBe('REF-0001');
  });

  it('prints Paid to, the sum, what it refunds, the reason and the method', () => {
    now = day('2026-11-12');
    pay.record(cash(5_000, [], { toCredit: 5_000 }));
    now = day('2026-11-27');
    const ref = pay.refund(refundOf(1_234));
    expect(pay.refundPrintable(ref)).toMatchObject({
      number: 'REF-0001',
      date: '2026-11-27',
      customer: { name: 'Tendai Moyo', address: 'Harare', phones: ['077 123 4567'] },
      sumInWords: 'Twelve US dollars and thirty-four cents only',
      refundOf: 'Unused Credit, from REC-0001 (12 Nov 2026)',
      reason: 'Job dropped before work started',
      method: 'ecocash',
      amount: 1_234,
    });
  });
});

describe('Credit held on the Start date (an Opening balance of Credit)', () => {
  const opening = () =>
    openingBalances(db, () => now).add({
      customerId: tendai, kind: 'credit', oldNumber: '', oldDate: null, amount: 4_000, note: 'Paid ahead for the roof', jobId: null,
    });

  it('is Credit: applied to an Invoice as "Credit applied from opening balance"', () => {
    const item = opening();
    expect(pay.creditHeld(tendai)).toBe(4_000);
    const rec = pay.applyCredit(invoice(3_000), 3_000);
    expect(pay.printable(rec).applied).toEqual({
      title: 'Credit applied from opening balance',
      notice: 'No new money was received. This applies Credit held from the opening balance (1 Jan 2026) to the Invoice below.',
    });
    expect(pay.creditHeld(tendai)).toBe(1_000);
    expect(openingBalances(db, () => now).item(item)).toMatchObject({ left: 1_000, status: 'open', depositOn: null });
    expect(problems(() => openingBalances(db, () => now).cancel(item, 'Entered twice')).reason).toBeTruthy();
    expect(failed()).toEqual([]);
  });

  it('can be refunded, and is then used up', () => {
    const item = opening();
    const ref = pay.refund(refundOf(4_000));
    expect(pay.refundDoc(ref).refundOf).toBe('Unused Credit, from the opening balance (1 Jan 2026)');
    expect(pay.creditHeld(tendai)).toBe(0);
    expect(openingBalances(db, () => now).item(item)).toMatchObject({ left: 0, status: 'used', depositOn: null });
    expect(failed()).toEqual([]);
  });

  it('is used oldest first, so Credit from the Start date goes before later Credit', () => {
    now = day('2026-11-20');
    opening();
    pay.record(cash(1_000, [], { toCredit: 1_000 }));
    now = day('2026-11-27');
    const rec = pay.applyCredit(invoice(4_500), 4_500);
    expect(pay.receipt(rec).appliedFrom.map((x) => x.number)).toEqual([null, 'REC-0001']);
    expect(pay.printable(rec).applied!.title).toBe('Credit applied');
  });
});
