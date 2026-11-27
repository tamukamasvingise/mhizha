import { beforeEach, describe, expect, it } from 'vitest';
import { checkLedger, customerBalances } from '../core';
import type { Db } from '../db';
import { documents, type Documents } from '../documents';
import { customerOwes, readJournal } from '../ledger';
import { InputError, noAddress, people, type People } from '../people';
import { emptyBusiness, saveBusinessDetails, startNew } from '../setup/store';
import { runChecks } from '../health/checks';
import { freshDb } from '../testing';
import { payments, type PaymentInput, type Payments } from '.';

// 27 November 2026, 14:00 in Harare (12:00 UTC).
const day = (d: string) => Date.parse(`${d}T12:00:00Z`);
let now = day('2026-11-27');
let db: Db;
let p: People;
let d: Documents;
let pay: Payments;
let tendai: string;
let kitchen: string;
let geyser: string;

function problems(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError) return e.problems;
    throw e;
  }
  throw new Error('expected an InputError');
}

/** Issues an Invoice of `cents` for a Job on the day `on`. */
function invoice(cents: number, on: string, jobId = kitchen, dueIn = 0): string {
  now = day(on);
  const id = d.newInvoice(tendai);
  d.setJob(id, jobId);
  d.setLines(id, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1_000, unitPrice: cents }]);
  if (dueIn) d.setDetails(id, { dueDate: on.slice(0, 8) + String(Number(on.slice(8)) + dueIn).padStart(2, '0'), orderNo: '' });
  d.issue(id);
  return id;
}

const cash = (amount: number, parts: PaymentInput['parts'], more: Partial<PaymentInput> = {}): PaymentInput => ({
  customerId: tendai,
  amount,
  dateReceived: '2026-11-27',
  method: 'cash',
  otherDescription: '',
  parts,
  separate: false,
  ...more,
});

beforeEach(() => {
  now = day('2026-11-27');
  db = freshDb(() => now);
  startNew(db, '2026-01-01');
  saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-01-01');
  p = people(db, () => '2026-11-27');
  tendai = p.addCustomer({
    kind: 'person', name: 'Tendai Moyo', phones: ['077 123 4567'], whatsapp: '', email: '',
    address: { ...noAddress, city: 'Harare' }, taxNumber: '', firstSiteName: 'Home', note: '',
  });
  const site = p.sites(tendai)[0]!.id;
  kitchen = p.addJob(tendai, { title: 'Kitchen rewiring', siteId: site });
  geyser = p.addJob(tendai, { title: 'Geyser', siteId: site });
  d = documents(db, () => now);
  pay = payments(db, () => now);
});

describe("a Customer's open Invoices", () => {
  it('are listed oldest first with what each still owes', () => {
    const older = invoice(10_000, '2026-11-02', geyser);
    const later = invoice(5_000, '2026-11-20');
    now = day('2026-11-27');
    expect(pay.owing(tendai).map((o) => [o.number, o.jobTitle, o.owed])).toEqual([
      ['INV-0001', 'Geyser', 10_000],
      ['INV-0002', 'Kitchen rewiring', 5_000],
    ]);
    pay.record(cash(10_000, [{ invoiceId: older, amount: 10_000 }]));
    expect(pay.owing(tendai).map((o) => o.id)).toEqual([later]);
  });
});

describe('recording a Payment', () => {
  it('issues one Receipt listing each Invoice, Job, amount applied and balance left', () => {
    const a = invoice(10_000, '2026-11-02', geyser);
    const b = invoice(5_000, '2026-11-20');
    now = day('2026-11-27');
    const [receiptId, ...more] = pay.record(cash(12_000, [{ invoiceId: a, amount: 10_000 }, { invoiceId: b, amount: 2_000 }]));
    expect(more).toEqual([]);
    const r = pay.receipt(receiptId!);
    expect(r).toMatchObject({
      number: 'REC-0001',
      issueDate: '2026-11-27',
      dateReceived: '2026-11-27',
      method: 'Cash',
      amount: 12_000,
      sumInWords: 'One hundred and twenty US dollars only',
      customerName: 'Tendai Moyo',
    });
    expect(r.lines.map((l) => [l.appliedTo, l.jobTitle, l.total, l.amount, l.balanceLeft])).toEqual([
      ['INV-0001', 'Geyser', 10_000, 10_000, 0],
      ['INV-0002', 'Kitchen rewiring', 5_000, 2_000, 3_000],
    ]);
    expect(customerOwes(db, tendai)).toBe(3_000);
  });

  it('works out Invoice status: Paid, Part-paid, Unpaid and Overdue', () => {
    const a = invoice(10_000, '2026-11-02');
    const b = invoice(5_000, '2026-11-20', kitchen, 10);
    const c = invoice(4_000, '2026-11-26', kitchen, 3);
    const late = invoice(1_000, '2026-11-26');
    now = day('2026-11-27');
    pay.record(cash(12_000, [{ invoiceId: a, amount: 10_000 }, { invoiceId: b, amount: 2_000 }]));
    expect([a, b, c, late].map((id) => d.issued(id).status)).toEqual(['paid', 'part-paid', 'unpaid', 'overdue']);
    expect(d.list({ filter: 'invoices' }).find((x) => x.id === b)?.status).toBe('part-paid');
  });

  it('gives one Payment and Receipt per Invoice when Separate receipts is chosen', () => {
    const a = invoice(10_000, '2026-11-02');
    const b = invoice(5_000, '2026-11-20');
    now = day('2026-11-27');
    const ids = pay.record(cash(15_000, [{ invoiceId: a, amount: 10_000 }, { invoiceId: b, amount: 5_000 }], { separate: true }));
    expect(ids.map((id) => [pay.receipt(id).number, pay.receipt(id).amount])).toEqual([
      ['REC-0001', 10_000],
      ['REC-0002', 5_000],
    ]);
    expect(db.get('SELECT count(*) AS n FROM payment')?.n).toBe(2);
    expect(d.list({ filter: 'receipts' }).map((x) => [x.title, x.status])).toEqual([
      ['REC-0002', 'received'],
      ['REC-0001', 'received'],
    ]);
  });

  it('posts the money account and Customers owe on the Date received, keeping the ledger in step', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    pay.record(cash(4_000, [{ invoiceId: a, amount: 4_000 }], { method: 'ecocash', dateReceived: '2026-11-25' }));
    const entry = readJournal(db).at(-1)!;
    expect(entry.accountingDate).toBe('2026-11-25');
    expect(entry.lines).toEqual([
      { account: '1030', side: 'debit', amount: 4_000 },
      { account: '1100', side: 'credit', amount: 4_000, customerId: tendai },
    ]);
    expect(customerBalances(readJournal(db), tendai)).toEqual({ owes: 6_000, depositsHeld: 0, creditHeld: 0 });
  });

  it('holds money received before the Invoice date for the Customer until that date, then applies it', () => {
    const a = invoice(10_000, '2026-11-20');
    now = day('2026-11-27');
    pay.record(cash(10_000, [{ invoiceId: a, amount: 10_000 }], { dateReceived: '2026-11-10' }));
    const [received, applied] = readJournal(db).slice(-2);
    expect(received!.accountingDate).toBe('2026-11-10');
    expect(received!.lines.map((l) => [l.account, l.side])).toEqual([['1010', 'debit'], ['2200', 'credit']]);
    expect(applied!.accountingDate).toBe('2026-11-20');
    expect(applied!.lines.map((l) => [l.account, l.side])).toEqual([['2200', 'debit'], ['1100', 'credit']]);
    expect(customerBalances(readJournal(db), tendai)).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 0 });
    expect(db.all('SELECT count(*) AS n FROM document WHERE type = ?', ['REC'])[0]?.n).toBe(1);
  });

  it('keeps an Other method with its description', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    expect(problems(() => pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { method: 'other' })))).toEqual({
      other: 'Say how they paid, for example "Cheque".',
    });
    const [id] = pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { method: 'other', otherDescription: ' Cheque ' }));
    expect(pay.receipt(id!).method).toBe('Other: Cheque');
  });
});

describe('a Payment is refused, saving nothing,', () => {
  let a: string;
  beforeEach(() => {
    a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
  });
  const nothingSaved = () => {
    expect(db.get('SELECT count(*) AS n FROM payment')?.n).toBe(0);
    expect(db.get("SELECT count(*) AS n FROM document WHERE type = 'REC'")?.n).toBe(0);
    expect(customerOwes(db, tendai)).toBe(10_000);
  };

  it('when the amount is zero', () => {
    expect(problems(() => pay.record(cash(0, [])))).toMatchObject({ amount: 'Enter the amount received, more than US$0.00.' });
    nothingSaved();
  });

  it('when no Invoice is ticked', () => {
    expect(problems(() => pay.record(cash(1_000, [])))).toMatchObject({ parts: 'Tick the Invoices this Payment is for.' });
    nothingSaved();
  });

  it('when it is more than an Invoice owes', () => {
    expect(problems(() => pay.record(cash(12_000, [{ invoiceId: a, amount: 12_000 }])))).toMatchObject({
      parts: 'INV-0001 owes US$100.00. Put no more than that on it.',
    });
    nothingSaved();
  });

  it('when the amounts on the Invoices do not add up to the amount received', () => {
    expect(problems(() => pay.record(cash(12_000, [{ invoiceId: a, amount: 10_000 }])))).toMatchObject({
      amount: 'US$20.00 of this is more than the ticked Invoices owe. Lower the amount, tick another Invoice, or keep it as Credit.',
    });
    nothingSaved();
  });

  it('when the Date received is after today', () => {
    expect(problems(() => pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { dateReceived: '2026-11-28' })))).toMatchObject({
      dateReceived: "The date received can't be after today.",
    });
    nothingSaved();
  });

  it("when an Invoice is another Customer's", () => {
    const chipo = p.addCustomer({
      kind: 'person', name: 'Chipo Ndlovu', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    expect(problems(() => pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { customerId: chipo })))).toHaveProperty('parts');
    nothingSaved();
  });

  it('when the phone clock is earlier than the last record', () => {
    now = day('2026-11-01');
    expect(problems(() => pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { dateReceived: '2026-11-01' })))).toHaveProperty('clock');
    nothingSaved();
  });

  it('when any part of the save fails', () => {
    db.run("CREATE TRIGGER fail_lines BEFORE INSERT ON receipt_line BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
    expect(() => pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }]))).toThrow(/disk full/);
    nothingSaved();
    expect(readJournal(db)).toHaveLength(1);
  });
});

describe('checking a Payment before it is saved', () => {
  it('says how many Receipts it issues and warns about a Date received in an earlier year', () => {
    now = day('2027-01-05');
    const a = invoice(10_000, '2027-01-02');
    const b = invoice(5_000, '2027-01-03');
    const input = cash(3_000, [{ invoiceId: a, amount: 2_000 }, { invoiceId: b, amount: 1_000 }], { dateReceived: '2026-12-31' });
    expect(pay.check(input)).toEqual({
      problems: {},
      warnings: ["This Payment is dated in 2026, an earlier year. Check the date; it is saved in 2026's records."],
      receipts: ['REC-0001'],
    });
    expect(pay.check({ ...input, separate: true }).receipts).toEqual(['REC-0001', 'REC-0002']);
  });
});

describe('Payment methods', () => {
  it('are the six, and unused ones can be hidden and shown again', () => {
    expect(pay.methods().map((m) => m.name)).toEqual(['Cash', 'Bank transfer', 'Card (swipe)', 'EcoCash', 'InnBucks', 'Other']);
    pay.setHidden('innbucks', true);
    pay.setHidden('card', true);
    expect(pay.methods().filter((m) => !m.hidden).map((m) => m.code)).toEqual(['cash', 'bank-transfer', 'ecocash', 'other']);
    pay.setHidden('card', false);
    expect(pay.methods().find((m) => m.code === 'card')?.hidden).toBe(false);
  });

  it('keep at least one shown', () => {
    for (const m of ['cash', 'bank-transfer', 'card', 'ecocash', 'innbucks'] as const) pay.setHidden(m, true);
    expect(problems(() => pay.setHidden('other', true))).toEqual({ method: 'Keep at least one way of being paid.' });
  });

  it('a hidden method stays on old Receipts', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    const [id] = pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }], { method: 'innbucks' }));
    pay.setHidden('innbucks', true);
    expect(pay.receipt(id!).method).toBe('InnBucks');
  });
});

describe('the records after Payments', () => {
  it('never change or lose a Payment, its allocations or its Receipt lines', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    pay.record(cash(1_000, [{ invoiceId: a, amount: 1_000 }]));
    for (const t of ['payment', 'allocation', 'receipt_line']) {
      expect(() => db.run(`DELETE FROM ${t}`)).toThrow();
      expect(() => db.run(`UPDATE ${t} SET changed_at = 'x'`)).toThrow();
    }
    const journal = readJournal(db);
    expect(checkLedger(journal, new Map([[tendai, { owes: 9_000, depositsHeld: 0, creditHeld: 0 }]]))).toEqual([]);
  });
});

describe('the check on open for Rule 5', () => {
  const rule5 = () => runChecks(db).find((r) => r.name.startsWith('Rule 5'))!;

  it('passes when each Payment, its split and its Receipt agree', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    pay.record(cash(4_000, [{ invoiceId: a, amount: 4_000 }]));
    expect(rule5()).toMatchObject({ outcome: 'passed', problems: [] });
  });

  it('fails, naming the Payment, when what it paid does not add up to it', () => {
    const a = invoice(10_000, '2026-11-02');
    now = day('2026-11-27');
    pay.record(cash(4_000, [{ invoiceId: a, amount: 4_000 }]));
    const payment = db.get('SELECT id, journal_entry_id FROM payment')!;
    db.insert('allocation', {
      journal_entry_id: String(payment.journal_entry_id), from_kind: 'payment', from_id: String(payment.id),
      to_kind: 'invoice', to_id: a, amount: 1,
    });
    expect(rule5()).toMatchObject({ outcome: 'failed', problems: [`Payment ${String(payment.id)}: what it paid does not add up to it.`] });
  });
});
