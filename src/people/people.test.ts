import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db';
import { nodePlatform } from '../db/node';
import { InputError, noAddress, people, type NewCustomer, type People } from '.';

let n = 0;
const bytes = (k: number) => {
  let c = ++n;
  const b = new Uint8Array(k);
  for (let i = k - 1; i >= 0; i--) {
    b[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return b;
};

let db: Db;
let today = '2026-11-27';
let p: People;

beforeEach(() => {
  const opened = openDatabase({ platform: nodePlatform(), appVersion: '1.0.0', random: bytes });
  if (!opened.ok) throw new Error('open failed');
  db = opened.db;
  today = '2026-11-27';
  p = people(db, () => today);
});

const harare = { lines: '4 Acacia Close', suburb: 'Borrowdale', city: 'Harare', province: 'Harare', country: 'Zimbabwe' };

const tendai = (more: Partial<NewCustomer> = {}): NewCustomer => ({
  kind: 'person',
  name: 'Tendai Moyo',
  phones: ['077 123 4567'],
  whatsapp: '',
  email: '',
  address: harare,
  taxNumber: '',
  firstSiteName: '',
  note: '',
  ...more,
});

describe('Customers', () => {
  it('adds a Customer with a first Site at the Customer address', () => {
    const id = p.addCustomer(tendai());
    expect(p.customer(id)).toMatchObject({ id, kind: 'person', name: 'Tendai Moyo', phones: ['077 123 4567'], archived: false });
    const sites = p.sites(id);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ name: 'Main site', address: harare, contactName: '', archived: false });
  });
});

describe('Customer details the User must fix', () => {
  const problems = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      if (e instanceof InputError) return e.problems;
      throw e;
    }
    throw new Error('expected an InputError');
  };

  it('needs a name, digits in phone numbers and an email address that looks like one', () => {
    expect(problems(() => p.addCustomer(tendai({ name: '  ', phones: ['077 123 4567', 'call me'], email: 'tendai', whatsapp: 'x' })))).toEqual({
      name: "Enter the Customer's name.",
      'phones.1': 'Enter a phone number using digits, for example 077 123 4567.',
      whatsapp: 'Enter a phone number using digits, for example 077 123 4567.',
      email: 'Enter an email address like name@example.com, or leave it empty.',
    });
    expect(db.get('SELECT count(*) AS n FROM customer')).toEqual({ n: 0 });
  });

  it('drops empty phone entries and trims what was typed', () => {
    const id = p.addCustomer(tendai({ name: ' Tendai Moyo ', phones: ['', ' 077 123 4567 ', ''], email: ' t@example.com ' }));
    expect(p.customer(id)).toMatchObject({ name: 'Tendai Moyo', phones: ['077 123 4567'], email: 't@example.com' });
  });
});

describe('changing and finding Customers', () => {
  it('changes a Customer and keeps its Sites', () => {
    const id = p.addCustomer(tendai());
    p.updateCustomer(id, { ...p.customer(id), kind: 'organisation', name: 'Moyo Holdings', taxNumber: '2000123456' });
    expect(p.customer(id)).toMatchObject({ kind: 'organisation', name: 'Moyo Holdings', taxNumber: '2000123456' });
    expect(p.sites(id)).toHaveLength(1);
  });

  it('lists Customers by name, finds them by part of a name or phone, and leaves out archived ones', () => {
    const t = p.addCustomer(tendai());
    const h = p.addCustomer(tendai({ kind: 'organisation', name: 'Harare Gardens Lodge', phones: ['024 270 0000'] }));
    const c = p.addCustomer(tendai({ name: 'chipo Ndlovu', phones: [] }));
    expect(p.customers().map((x) => x.id)).toEqual([c, h, t]);
    expect(p.customers({ search: 'GARDEN' }).map((x) => x.id)).toEqual([h]);
    expect(p.customers({ search: '0242700' }).map((x) => x.id)).toEqual([h]);
    p.archiveCustomer(h);
    expect(p.customers().map((x) => x.id)).toEqual([c, t]);
    expect(p.customers({ archived: true }).map((x) => x.id)).toEqual([h]);
    expect(p.customer(h).archived).toBe(true);
    p.unarchiveCustomer(h);
    expect(p.customers().map((x) => x.id)).toEqual([c, h, t]);
  });

  it('the list shows each Customer\'s first Site and whether a follow-up is due', () => {
    const t = p.addCustomer(tendai({ firstSiteName: 'House' }));
    p.setFollowUp(t, '2026-11-27');
    const [row] = p.customers();
    expect(row).toMatchObject({ id: t, firstSite: 'House', followUpDue: true });
  });
});

const cottages = { name: 'Staff cottages', address: { ...noAddress, lines: 'Plot 22', city: 'Ruwa' }, contactName: 'Mr Banda', contactPhone: '078 555 1212' };

describe('Sites', () => {
  it('adds and changes a Site with its own address and contact person', () => {
    const c = p.addCustomer(tendai());
    const s = p.addSite(c, cottages);
    expect(p.site(s)).toMatchObject({ customerId: c, ...cottages, archived: false });
    p.updateSite(s, { ...cottages, contactName: '' });
    expect(p.site(s).contactName).toBe('');
    expect(p.sites(c).map((x) => x.name)).toEqual(['Main site', 'Staff cottages']);
  });

  it('needs a name and a phone number made of digits', () => {
    const c = p.addCustomer(tendai());
    expect(() => p.addSite(c, { ...cottages, name: ' ', contactPhone: 'none' })).toThrow(InputError);
  });

  it('archives a Site but never the last one a Customer has', () => {
    const c = p.addCustomer(tendai());
    const s = p.addSite(c, cottages);
    p.archiveSite(s);
    expect(p.sites(c).map((x) => x.name)).toEqual(['Main site']);
    expect(p.sites(c, { archived: true }).map((x) => x.name)).toEqual(['Main site', 'Staff cottages']);
    expect(() => p.archiveSite(p.sites(c)[0]!.id)).toThrow("A Customer needs at least one Site. Add another Site before archiving this one.");
    p.unarchiveSite(s);
    expect(p.sites(c)).toHaveLength(2);
  });
});

describe('Jobs', () => {
  const setUp = () => {
    const c = p.addCustomer(tendai());
    const site = p.sites(c)[0]!.id;
    return { c, site, job: p.addJob(c, { title: 'Kitchen rewiring', siteId: site }) };
  };

  it('a new Job is Open, at one Site of its Customer', () => {
    const { c, site, job } = setUp();
    expect(p.job(job)).toMatchObject({ id: job, customerId: c, siteId: site, title: 'Kitchen rewiring', status: 'open', finishedOn: '', archived: false });
    expect(p.jobs(c).map((j) => j.id)).toEqual([job]);
  });

  it('refuses a Job without a title, or at a Site of another Customer', () => {
    const { c } = setUp();
    const other = p.addCustomer(tendai({ name: 'Chipo' }));
    expect(() => p.addJob(c, { title: '', siteId: p.sites(c)[0]!.id })).toThrow(InputError);
    expect(() => p.addJob(c, { title: 'Sockets', siteId: p.sites(other)[0]!.id })).toThrow();
  });

  it('marking Done records the date work finished: today, or earlier, never later', () => {
    const { job } = setUp();
    expect(() => p.markDone(job, '2026-11-28')).toThrow('The date work finished cannot be later than today.');
    expect(() => p.markDone(job, '2026-02-30')).toThrow(InputError);
    p.markDone(job, '2026-11-20');
    expect(p.job(job)).toMatchObject({ status: 'done', finishedOn: '2026-11-20' });
  });

  it('a Done or Dropped Job can be opened again, and only an Open Job can be marked Done or Dropped', () => {
    const { job } = setUp();
    p.markDropped(job);
    expect(p.job(job).status).toBe('dropped');
    expect(() => p.markDone(job, today)).toThrow('Open this Job again first.');
    p.reopen(job);
    expect(p.job(job)).toMatchObject({ status: 'open', finishedOn: '' });
    p.markDone(job, today);
    expect(() => p.markDropped(job)).toThrow('Open this Job again first.');
    expect(() => p.reopen(p.addJob(p.job(job).customerId, { title: 'x', siteId: p.job(job).siteId }))).toThrow('This Job is already open.');
    expect(db.all('SELECT event FROM job_event WHERE job_id = ? ORDER BY rowid', [job]).map((r) => r.event)).toEqual([
      'opened',
      'dropped',
      'reopened',
      'done',
    ]);
  });

  it('archives a Job, which hides it but keeps it', () => {
    const { c, job } = setUp();
    p.archiveJob(job);
    expect(p.jobs(c)).toEqual([]);
    expect(p.jobs(c, { archived: true }).map((j) => j.id)).toEqual([job]);
    p.unarchiveJob(job);
    expect(p.jobs(c)).toHaveLength(1);
  });

  it('a Job cannot be put at an archived Site', () => {
    const { c } = setUp();
    const s = p.addSite(c, cottages);
    p.archiveSite(s);
    expect(() => p.addJob(c, { title: 'Sockets', siteId: s })).toThrow(InputError);
  });
});

describe('notes and follow-ups', () => {
  it('keeps dated notes, newest first, and a first note given with a new Customer', () => {
    const c = p.addCustomer(tendai({ note: 'Prefers WhatsApp.' }));
    today = '2026-11-28';
    const n = p.addNote(c, 'Gate code from the guard.');
    expect(p.notes(c).map((x) => [x.date, x.text])).toEqual([
      ['2026-11-28', 'Gate code from the guard.'],
      ['2026-11-27', 'Prefers WhatsApp.'],
    ]);
    p.updateNote(n, 'Gate code 1234.');
    expect(p.notes(c)[0]!.text).toBe('Gate code 1234.');
    expect(() => p.addNote(c, '  ')).toThrow(InputError);
  });

  it('one open follow-up date per Customer, changed or marked done', () => {
    const c = p.addCustomer(tendai());
    expect(p.followUp(c)).toBeNull();
    expect(() => p.setFollowUp(c, '2026-11-26')).toThrow('Pick today or a later day.');
    p.setFollowUp(c, '2026-12-01');
    p.setFollowUp(c, '2026-12-03');
    expect(p.followUp(c)).toEqual({ id: expect.any(String), dueDate: '2026-12-03' });
    p.followUpDone(c);
    expect(p.followUp(c)).toBeNull();
    expect(db.get('SELECT count(*) AS n FROM follow_up')).toEqual({ n: 1 });
  });
});
