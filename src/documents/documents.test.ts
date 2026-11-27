import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { customerOwes, readJournal, totalOwed } from '../ledger';
import { InputError, noAddress, people, type People } from '../people';
import { addPriceItem, readPriceItem } from '../prices/priceList';
import { documentCounters, emptyBusiness, saveBusinessDetails, setStartingNumber, startNew } from '../setup/store';
import { freshDb } from '../testing';
import { documents, type Documents, type LineInput } from '.';

// 27 November 2026, 14:00 in Harare (12:00 UTC).
let now = Date.UTC(2026, 10, 27, 12, 0, 0);
let db: Db;
let p: People;
let d: Documents;
let tendai: string;
let kitchen: string;

const hours = (h: number) => h * 60 * 60 * 1000;

function problems(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError) return e.problems;
    throw e;
  }
  throw new Error('expected an InputError');
}

const labour: LineInput = { priceListItemId: null, description: 'Labour', unit: 'day', quantity: 2_000, unitPrice: 4_500 };
const cable: LineInput = { priceListItemId: null, description: 'Cable 2.5mm', unit: 'm', quantity: 12_500, unitPrice: 199 };

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

function readyDraft(): string {
  const id = d.newInvoice(tendai);
  d.setJob(id, kitchen);
  d.setLines(id, [labour, cable]);
  return id;
}

describe('a Draft Invoice', () => {
  it('has no number, is for a Customer, and can be given a Job and lines', () => {
    const id = d.newInvoice(tendai);
    expect(d.draft(id)).toMatchObject({ id, type: 'INV', customerId: tendai, jobId: null, lines: [], discount: null });
    d.setJob(id, kitchen);
    d.setLines(id, [labour, cable]);
    const draft = d.draft(id);
    expect(draft.jobId).toBe(kitchen);
    expect(draft.lines.map((l) => [l.description, l.amount])).toEqual([['Labour', 9_000], ['Cable 2.5mm', 2_488]]);
    expect(draft.totals).toMatchObject({ subtotal: 11_488, discount: 0, total: 11_488 });
    expect(db.get('SELECT number FROM document WHERE id = ?', [id])?.number).toBeNull();
  });

  it('copies name, unit and price from the Price list, and the copy can be changed on the Document', () => {
    const item = addPriceItem(db, { name: 'Socket outlet', unit: 'each', unitPrice: '12.50' });
    if (!item.ok) throw new Error('item');
    const id = d.newInvoice(tendai);
    d.setLines(id, [d.lineFromPriceItem(readPriceItem(db, item.id)!)]);
    const [line] = d.draft(id).lines;
    expect(line).toMatchObject({ priceListItemId: item.id, description: 'Socket outlet', unit: 'each', quantity: 1_000, unitPrice: 1_250 });
    d.setLines(id, [{ ...line!, unitPrice: 1_100, quantity: 3_000 }]);
    expect(d.draft(id).lines[0]).toMatchObject({ id: line!.id, priceListItemId: item.id, unitPrice: 1_100, amount: 3_300 });
    expect(readPriceItem(db, item.id)!.unitPrice).toBe(1_250);
  });

  it('keeps a removed line as a deleted marker, never erasing it', () => {
    const id = readyDraft();
    d.setLines(id, [d.draft(id).lines[1]!]);
    expect(d.draft(id).lines.map((l) => l.description)).toEqual(['Cable 2.5mm']);
    expect(db.get('SELECT count(*) AS n FROM document_line WHERE document_id = ?', [id])?.n).toBe(2);
  });

  it('refuses a line with no description, or a Job of another Customer', () => {
    const id = d.newInvoice(tendai);
    expect(problems(() => d.setLines(id, [{ ...labour, description: ' ' }]))).toHaveProperty('lines');
    const chipo = p.addCustomer({
      kind: 'person', name: 'Chipo Ndlovu', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const other = p.addJob(chipo, { title: 'Roof', siteId: p.sites(chipo)[0]!.id });
    expect(problems(() => d.setJob(id, other))).toHaveProperty('job');
  });

  it('takes one Discount, as an amount or a percentage, never above the Subtotal', () => {
    const id = readyDraft();
    d.setDiscount(id, { kind: 'percent', tenths: 100 });
    expect(d.draft(id).totals).toMatchObject({ subtotal: 11_488, discount: 1_149, total: 10_339 });
    d.setDiscount(id, { kind: 'amount', cents: 488 });
    expect(d.draft(id).totals).toMatchObject({ discount: 488, total: 11_000 });
    expect(problems(() => d.setDiscount(id, { kind: 'amount', cents: 20_000 }))).toEqual({
      discount: "The Discount can't be more than the Subtotal.",
    });
    d.setDiscount(id, null);
    expect(d.draft(id).totals.discount).toBe(0);
  });

  it('changing the Customer drops a Job that is not theirs', () => {
    const id = readyDraft();
    const chipo = p.addCustomer({
      kind: 'person', name: 'Chipo Ndlovu', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    d.setCustomer(id, chipo);
    expect(d.draft(id)).toMatchObject({ customerId: chipo, jobId: null });
  });

  it('can be deleted, leaving a marker, and is then gone from the lists', () => {
    const id = readyDraft();
    d.deleteDraft(id);
    expect(d.list()).toEqual([]);
    expect(db.get('SELECT deleted_at FROM document WHERE id = ?', [id])?.deleted_at).not.toBeNull();
  });
});

describe('issuing an Invoice', () => {
  it('gives the next INV number, sets the issue date and time, records "not registered", and locks it', () => {
    const id = readyDraft();
    expect(d.nextNumber('INV')).toBe('INV-0001');
    expect(d.issue(id)).toBe('INV-0001');
    const inv = d.issued(id);
    expect(inv).toMatchObject({
      number: 'INV-0001',
      issuedAt: '2026-11-27T12:00:00.000Z',
      timeZone: 'Africa/Harare',
      issueDate: '2026-11-27',
      dueDate: '2026-11-27',
      taxStatus: 'not registered',
      subtotal: 11_488,
      discount: 0,
      total: 11_488,
      sumInWords: 'One hundred and fourteen US dollars and eighty-eight cents only',
    });
    expect(() => d.setLines(id, [labour])).toThrow();
    expect(() => d.deleteDraft(id)).toThrow();
    expect(() => db.run('UPDATE document SET total = 1 WHERE id = ?', [id])).toThrow(/locked/);
    expect(() => db.run("UPDATE document_line SET amount = 1 WHERE document_id = ?", [id])).toThrow(/locked/);
  });

  it('numbers carry on from the starting number and lock it', () => {
    setStartingNumber(db, 'INV', 46);
    expect(d.issue(readyDraft())).toBe('INV-0046');
    expect(d.issue(readyDraft())).toBe('INV-0047');
    expect(documentCounters(db).find((c) => c.type === 'INV')).toMatchObject({ lastNumber: 47, locked: true });
  });

  it('keeps a frozen copy of the Business, Customer, Site and Job details', () => {
    const id = readyDraft();
    d.issue(id);
    p.updateCustomer(tendai, { ...p.customer(tendai), name: 'Tendai M. Moyo' });
    saveBusinessDetails(db, { ...emptyBusiness(), name: 'New Name Ltd' }, '2026-11-28');
    const { frozen } = d.issued(id);
    expect(frozen.business.name).toBe('Demo Building Services');
    expect(frozen.customer).toMatchObject({ name: 'Tendai Moyo', phones: ['077 123 4567'] });
    expect(frozen.site).toMatchObject({ name: 'Home' });
    expect(frozen.job).toEqual({ title: 'Kitchen rewiring' });
  });

  it('posts Customers owe and Sales in the same save, after Discount', () => {
    const id = readyDraft();
    d.setDiscount(id, { kind: 'amount', cents: 488 });
    d.issue(id);
    expect(customerOwes(db, tendai)).toBe(11_000);
    expect(totalOwed(db)).toBe(11_000);
    const [entry] = readJournal(db);
    expect(entry).toMatchObject({ accountingDate: '2026-11-27', source: { kind: 'invoice', id } });
    expect(entry!.lines).toEqual([
      { account: '1100', side: 'debit', amount: 11_000, customerId: tendai },
      { account: '4000', side: 'credit', amount: 11_000 },
    ]);
  });

  it('saves nothing when the posting fails', () => {
    const id = readyDraft();
    db.run("CREATE TRIGGER break_it BEFORE INSERT ON journal_line BEGIN SELECT RAISE(ABORT, 'broken'); END;");
    expect(() => d.issue(id)).toThrow(/broken/);
    expect(d.draft(id).id).toBe(id);
    expect(documentCounters(db).find((c) => c.type === 'INV')!.lastNumber).toBeNull();
    expect(readJournal(db)).toEqual([]);
  });

  it('needs a Job, a line and a Total above zero', () => {
    const id = d.newInvoice(tendai);
    expect(problems(() => d.issue(id))).toMatchObject({ job: expect.any(String), lines: expect.any(String) });
    d.setJob(id, kitchen);
    d.setLines(id, [{ ...labour, unitPrice: 0 }]);
    expect(problems(() => d.issue(id))).toEqual({ total: 'The Total must be above zero. Add a price to a line.' });
  });

  it('is blocked while the phone clock is earlier than the last recorded entry', () => {
    d.issue(readyDraft());
    const late = readyDraft();
    now -= hours(3);
    expect(problems(() => d.issue(late))).toEqual({
      clock: "The phone's clock is earlier than your last record (27 November 2026, 14:00). Set the phone's date and time right, then issue.",
    });
    now += hours(4);
    expect(d.issue(late)).toBe('INV-0002');
  });

  it('due date defaults to the issue date; a later one and an Order No. can be given', () => {
    const id = readyDraft();
    d.setDetails(id, { dueDate: '2026-12-11', orderNo: ' PO 778 ' });
    expect(d.draft(id)).toMatchObject({ dueDate: '2026-12-11', orderNo: 'PO 778' });
    d.issue(id);
    expect(d.issued(id)).toMatchObject({ dueDate: '2026-12-11', orderNo: 'PO 778' });
  });

  it('refuses a due date before the issue date', () => {
    const id = readyDraft();
    d.setDetails(id, { dueDate: '2026-11-30', orderNo: '' });
    now += hours(24 * 5);
    expect(problems(() => d.issue(id))).toEqual({ dueDate: 'The due date is before today. Pick today or a later day.' });
  });

  it('needs the business details first', () => {
    const bare = freshDb(() => now);
    startNew(bare, '2026-11-27');
    const bp = people(bare, () => '2026-11-27');
    const c = bp.addCustomer({
      kind: 'person', name: 'X', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const bd = documents(bare, () => now);
    const id = bd.newInvoice(c);
    bd.setJob(id, bp.addJob(c, { title: 'Job', siteId: bp.sites(c)[0]!.id }));
    bd.setLines(id, [labour]);
    expect(problems(() => bd.issue(id))).toHaveProperty('business');
  });
});

describe('the Documents list', () => {
  it('shows Drafts first, then the newest Issued, same day higher number first', () => {
    const first = readyDraft();
    d.issue(first);
    now += hours(1);
    const second = readyDraft();
    d.issue(second);
    now += hours(24);
    const third = readyDraft();
    d.issue(third);
    const draft = readyDraft();
    expect(d.list().map((x) => x.id)).toEqual([draft, third, second, first]);
    expect(d.list()[0]).toMatchObject({ title: 'Draft Invoice', customerName: 'Tendai Moyo', jobTitle: 'Kitchen rewiring', status: 'draft' });
    expect(d.list()[1]).toMatchObject({ title: 'INV-0003', total: 11_488, date: '2026-11-28', status: 'unpaid' });
  });

  it('filters Drafts, Quotations, Invoices and Receipts, and by Customer or Job', () => {
    d.issue(readyDraft());
    const draft = readyDraft();
    expect(d.list({ filter: 'drafts' }).map((x) => x.id)).toEqual([draft]);
    expect(d.list({ filter: 'invoices' })).toHaveLength(2);
    expect(d.list({ filter: 'quotations' })).toEqual([]);
    expect(d.list({ filter: 'receipts' })).toEqual([]);
    expect(d.list({ customerId: tendai })).toHaveLength(2);
    expect(d.list({ jobId: kitchen })).toHaveLength(2);
    expect(d.list({ customerId: 'nobody' })).toEqual([]);
  });

  it('shows an Invoice past its due date with money owing as Overdue', () => {
    d.issue(readyDraft());
    now += hours(24);
    expect(d.list()[0]!.status).toBe('overdue');
  });
});

describe('what an Invoice prints', () => {
  it('prints an Issued Invoice from its frozen copy, even after the Customer changes', () => {
    const id = readyDraft();
    d.setDetails(id, { dueDate: '2026-12-11', orderNo: 'PO 4471' });
    d.setDiscount(id, { kind: 'percent', tenths: 100 });
    d.issue(id);
    const c = p.customer(tendai);
    p.updateCustomer(tendai, { ...c, name: 'Tendai Moyo-Ncube' });
    const printed = d.printable(id);
    expect(printed).toMatchObject({
      number: 'INV-0001',
      issueDate: '2026-11-27',
      dueDate: '2026-12-11',
      orderNo: 'PO 4471',
      quoteRef: '',
      customer: { name: 'Tendai Moyo', address: 'Harare', phones: ['077 123 4567'], email: '' },
      site: { location: 'Home, Harare', contact: '' },
      job: 'Kitchen rewiring',
      subtotal: 11_488,
      discount: 1_149,
      discountKind: { kind: 'percent', tenths: 100 },
      total: 10_339,
      sumInWords: 'One hundred and three US dollars and thirty-nine cents only',
    });
    expect(printed.business.name).toBe('Demo Building Services');
    expect(printed.lines.map((l) => [l.description, l.amount])).toEqual([['Labour', 9_000], ['Cable 2.5mm', 2_488]]);
  });

  it('prints a Draft as it stands now, with no number, dated today', () => {
    const id = readyDraft();
    const printed = d.printable(id);
    expect(printed).toMatchObject({ number: null, issueDate: '2026-11-27', dueDate: '2026-11-27', customer: { name: 'Tendai Moyo' }, total: 11_488 });
    expect(printed.sumInWords).toBe('One hundred and fourteen US dollars and eighty-eight cents only');
  });
});

describe('the PDF of an Issued Invoice', () => {
  const pdfFile = () => db.insert('file', { kind: 'pdf', path: 'pdfs/x/INV-0001.pdf', checksum: 'abc', size: 10 });

  it('is recorded once and never replaced', () => {
    const id = readyDraft();
    d.issue(id);
    expect(d.issued(id).pdfFileId).toBeNull();
    const first = pdfFile();
    d.setPdf(id, first);
    expect(d.issued(id).pdfFileId).toBe(first);
    expect(() => d.setPdf(id, pdfFile())).toThrow();
    expect(d.issued(id).pdfFileId).toBe(first);
  });

  it('is never made for a Draft', () => {
    const id = readyDraft();
    expect(() => d.setPdf(id, pdfFile())).toThrow(/Draft/);
  });
});
