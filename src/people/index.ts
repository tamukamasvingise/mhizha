// Customers, their Sites and Jobs (spec section 5): plain TypeScript over the
// records, free of React. Screens use `people(useDb(), today)`.
//
// Nothing here is ever deleted: Customers, Sites and Jobs are archived, which
// hides them from lists and pickers while their history stays. A Job's status
// is worked out from its events, never stored.
import { isAccountingDate } from '../core';
import type { Db, Row, SqlValue } from '../db';

export type Address = { lines: string; suburb: string; city: string; province: string; country: string };
export const noAddress: Address = { lines: '', suburb: '', city: '', province: '', country: '' };

export type CustomerKind = 'person' | 'organisation';

export type CustomerDetails = {
  kind: CustomerKind;
  name: string;
  /** In the order the User gave them; empty entries are dropped. */
  phones: string[];
  whatsapp: string;
  email: string;
  address: Address;
  taxNumber: string;
};

/** A new Customer: its details, the name of its first Site (at the Customer's address) and an optional first note. */
export type NewCustomer = CustomerDetails & { firstSiteName: string; note: string };

export type Customer = CustomerDetails & { id: string; archived: boolean };

export type SiteDetails = { name: string; address: Address; contactName: string; contactPhone: string };
export type Site = SiteDetails & { id: string; customerId: string; archived: boolean };

/** Input the User must fix. `problems` maps a field to what to do, in plain words. */
export class InputError extends Error {
  constructor(readonly problems: Record<string, string>) {
    super(Object.values(problems).join(' '));
    this.name = 'InputError';
  }
}

const text = (v: SqlValue | undefined): string => (v == null ? '' : String(v));
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

function addressColumns(a: Address): Record<string, SqlValue> {
  return {
    address_lines: orNull(a.lines),
    suburb: orNull(a.suburb),
    city: orNull(a.city),
    province: orNull(a.province),
    country: orNull(a.country),
  };
}

function addressOf(r: Row): Address {
  return {
    lines: text(r.address_lines),
    suburb: text(r.suburb),
    city: text(r.city),
    province: text(r.province),
    country: text(r.country),
  };
}

function toCustomer(r: Row): Customer {
  return {
    id: String(r.id),
    kind: r.kind as CustomerKind,
    name: String(r.name),
    phones: JSON.parse(String(r.phones)) as string[],
    whatsapp: text(r.whatsapp),
    email: text(r.email),
    address: addressOf(r),
    taxNumber: text(r.tax_number),
    archived: r.archived_at != null,
  };
}

function toSite(r: Row): Site {
  return {
    id: String(r.id),
    customerId: String(r.customer_id),
    name: String(r.name),
    address: addressOf(r),
    contactName: text(r.contact_name),
    contactPhone: text(r.contact_phone),
    archived: r.archived_at != null,
  };
}

const PHONE = /^\+?[0-9 ()\-.]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneProblem = 'Enter a phone number using digits, for example 077 123 4567.';

/** True if `raw` is empty or looks like a phone number. */
export function isPhone(raw: string): boolean {
  const v = raw.trim();
  return v === '' || (PHONE.test(v) && v.replace(/\D/g, '').length >= 5);
}

function check(problems: Record<string, string>) {
  if (Object.keys(problems).length > 0) throw new InputError(problems);
}

function customerProblems(d: CustomerDetails): Record<string, string> {
  const problems: Record<string, string> = {};
  if (d.name.trim() === '') problems.name = "Enter the Customer's name.";
  d.phones.forEach((ph, i) => {
    if (!isPhone(ph)) problems[`phones.${i}`] = phoneProblem;
  });
  if (!isPhone(d.whatsapp)) problems.whatsapp = phoneProblem;
  if (d.email.trim() !== '' && !EMAIL.test(d.email.trim()))
    problems.email = 'Enter an email address like name@example.com, or leave it empty.';
  return problems;
}

function siteProblems(s: SiteDetails): Record<string, string> {
  const problems: Record<string, string> = {};
  if (s.name.trim() === '') problems.name = 'Name the Site, for example "House" or "Staff cottages".';
  if (!isPhone(s.contactPhone)) problems.contactPhone = phoneProblem;
  return problems;
}

function siteColumns(s: SiteDetails): Record<string, SqlValue> {
  return {
    name: s.name.trim(),
    ...addressColumns(s.address),
    contact_name: orNull(s.contactName),
    contact_phone: orNull(s.contactPhone),
  };
}

export type JobStatus = 'open' | 'done' | 'dropped';
export type JobDetails = { title: string; siteId: string };
export type Job = JobDetails & {
  id: string;
  customerId: string;
  siteName: string;
  status: JobStatus;
  /** The date work finished, for a Done Job; otherwise empty. */
  finishedOn: string;
  archived: boolean;
};

// The latest event decides a Job's status.
const JOB_SELECT = `SELECT j.*, s.name AS site_name, e.event, e.finished_on FROM job j
  JOIN site s ON s.id = j.site_id
  JOIN job_event e ON e.rowid = (SELECT max(rowid) FROM job_event WHERE job_id = j.id)`;

function toJob(r: Row): Job {
  const event = String(r.event);
  return {
    id: String(r.id),
    customerId: String(r.customer_id),
    siteId: String(r.site_id),
    siteName: String(r.site_name),
    title: String(r.title),
    status: event === 'done' ? 'done' : event === 'dropped' ? 'dropped' : 'open',
    finishedOn: text(r.finished_on),
    archived: r.archived_at != null,
  };
}

export type Note = { id: string; text: string; date: string };
export type FollowUp = { id: string; dueDate: string };

const stamp = () => new Date().toISOString();

export type CustomerListItem ={ id: string; name: string; firstSite: string; followUpDue: boolean };

function customerColumns(d: CustomerDetails): Record<string, SqlValue> {
  return {
    kind: d.kind,
    name: d.name.trim(),
    phones: JSON.stringify(d.phones.map((p) => p.trim()).filter((p) => p !== '')),
    whatsapp: orNull(d.whatsapp),
    email: orNull(d.email),
    ...addressColumns(d.address),
    tax_number: orNull(d.taxNumber),
  };
}

export function people(db: Db, today: () => string) {
  const one = <T>(sql: string, id: string, map: (r: Row) => T): T => {
    const r = db.get(sql, [id]);
    if (!r) throw new Error(`No record ${id}`);
    return map(r);
  };

  function addEvent(jobId: string, event: 'done' | 'dropped' | 'reopened', finishedOn: string | null) {
    db.transaction(() => {
      const status = one(`${JOB_SELECT} WHERE j.id = ?`, jobId, toJob).status;
      if (event === 'reopened' && status === 'open') throw new InputError({ status: 'This Job is already open.' });
      if (event !== 'reopened' && status !== 'open') throw new InputError({ status: 'Open this Job again first.' });
      db.insert('job_event', { job_id: jobId, event, finished_on: finishedOn });
    });
  }

  return {
    addCustomer(c: NewCustomer): string {
      check(customerProblems(c));
      return db.transaction(() => {
        const id = db.insert('customer', customerColumns(c));
        db.insert('site', { customer_id: id, name: c.firstSiteName.trim() || 'Main site', ...addressColumns(c.address) });
        if (c.note.trim() !== '') db.insert('customer_note', { customer_id: id, text: c.note.trim(), note_date: today() });
        return id;
      });
    },

    updateCustomer(id: string, d: CustomerDetails) {
      check(customerProblems(d));
      db.update('customer', id, customerColumns(d));
    },

    customer: (id: string): Customer => one('SELECT * FROM customer WHERE id = ?', id, toCustomer),

    /** Customers by name. `search` matches part of a name, or the digits of a phone number. */
    addSite(customerId: string, s: SiteDetails): string {
      check(siteProblems(s));
      return db.insert('site', { customer_id: customerId, ...siteColumns(s) });
    },

    updateSite(id: string, s: SiteDetails) {
      check(siteProblems(s));
      db.update('site', id, siteColumns(s));
    },

    site: (id: string): Site => one('SELECT * FROM site WHERE id = ?', id, toSite),

    /** A Customer's Sites, oldest first; archived ones only if asked for. */
    sites: (customerId: string, { archived = false } = {}): Site[] =>
      db
        .all(`SELECT * FROM site WHERE customer_id = ? ${archived ? '' : 'AND archived_at IS NULL'} ORDER BY created_at, rowid`, [
          customerId,
        ])
        .map(toSite),

    archiveSite(id: string) {
      db.transaction(() => {
        const s = one('SELECT * FROM site WHERE id = ?', id, toSite);
        const left = db.get('SELECT count(*) AS n FROM site WHERE customer_id = ? AND archived_at IS NULL AND id <> ?', [
          s.customerId,
          id,
        ]);
        if (Number(left?.n) === 0)
          throw new InputError({ site: 'A Customer needs at least one Site. Add another Site before archiving this one.' });
        db.update('site', id, { archived_at: stamp() });
      });
    },
    unarchiveSite: (id: string) => db.update('site', id, { archived_at: null }),

    addJob(customerId: string, j: JobDetails): string {
      const problems: Record<string, string> = {};
      if (j.title.trim() === '') problems.title = 'Say what the work is, for example "Kitchen rewiring".';
      const site = db.get('SELECT archived_at FROM site WHERE id = ? AND customer_id = ?', [j.siteId, customerId]);
      if (site?.archived_at != null) problems.siteId = 'This Site is archived. Pick another Site.';
      check(problems);
      return db.transaction(() => {
        const id = db.insert('job', { customer_id: customerId, site_id: j.siteId, title: j.title.trim() });
        db.insert('job_event', { job_id: id, event: 'opened' });
        return id;
      });
    },

    updateJob(id: string, j: JobDetails) {
      if (j.title.trim() === '') throw new InputError({ title: 'Say what the work is, for example "Kitchen rewiring".' });
      db.update('job', id, { title: j.title.trim(), site_id: j.siteId });
    },

    job: (id: string): Job => one(`${JOB_SELECT} WHERE j.id = ?`, id, toJob),

    /** A Customer's Jobs, newest first; archived ones only if asked for. */
    jobs: (customerId: string, { archived = false } = {}): Job[] =>
      db
        .all(`${JOB_SELECT} WHERE j.customer_id = ? AND (j.archived_at IS NOT NULL) = ? ORDER BY j.created_at DESC, j.rowid DESC`, [
          customerId,
          archived ? 1 : 0,
        ])
        .map(toJob),

    /** Marks an Open Job Done. `finishedOn` is the date work finished: today or earlier. */
    markDone(id: string, finishedOn: string) {
      if (!isAccountingDate(finishedOn)) throw new InputError({ finishedOn: 'Pick the day the work finished.' });
      if (finishedOn > today()) throw new InputError({ finishedOn: 'The date work finished cannot be later than today.' });
      addEvent(id, 'done', finishedOn);
    },
    markDropped: (id: string) => addEvent(id, 'dropped', null),
    reopen: (id: string) => addEvent(id, 'reopened', null),

    archiveJob: (id: string) => db.update('job', id, { archived_at: stamp() }),
    unarchiveJob: (id: string) => db.update('job', id, { archived_at: null }),

    addNote(customerId: string, note: string): string {
      if (note.trim() === '') throw new InputError({ note: 'Write the note, or close this.' });
      return db.insert('customer_note', { customer_id: customerId, text: note.trim(), note_date: today() });
    },
    updateNote(id: string, note: string) {
      if (note.trim() === '') throw new InputError({ note: 'Write the note, or close this.' });
      db.update('customer_note', id, { text: note.trim() });
    },
    /** A Customer's notes, newest first. */
    notes: (customerId: string): Note[] =>
      db
        .all('SELECT id, text, note_date FROM customer_note WHERE customer_id = ? ORDER BY note_date DESC, rowid DESC', [customerId])
        .map((r) => ({ id: String(r.id), text: String(r.text), date: String(r.note_date) })),

    followUp(customerId: string): FollowUp | null {
      const r = db.get('SELECT id, due_date FROM follow_up WHERE customer_id = ? AND done_at IS NULL', [customerId]);
      return r ? { id: String(r.id), dueDate: String(r.due_date) } : null;
    },
    followUpDone(customerId: string) {
      const r = db.get('SELECT id FROM follow_up WHERE customer_id = ? AND done_at IS NULL', [customerId]);
      if (r) db.update('follow_up', String(r.id), { done_at: stamp() });
    },

    customers({ search = '', archived = false } = {}): CustomerListItem[] {
      const rows = db.all(
        `SELECT c.id, c.name, c.phones, c.whatsapp,
           (SELECT s.name FROM site s WHERE s.customer_id = c.id AND s.archived_at IS NULL ORDER BY s.created_at, s.rowid LIMIT 1) AS first_site,
           EXISTS (SELECT 1 FROM follow_up f WHERE f.customer_id = c.id AND f.done_at IS NULL AND f.due_date <= ?) AS due
         FROM customer c WHERE (c.archived_at IS NOT NULL) = ? ORDER BY c.name COLLATE NOCASE, c.rowid`,
        [today(), archived ? 1 : 0],
      );
      const words = search.trim().toLowerCase();
      const digits = search.replace(/\D/g, '');
      return rows
        .filter((r) => {
          if (words === '') return true;
          if (String(r.name).toLowerCase().includes(words)) return true;
          if (digits.length < 3) return false;
          const numbers = [...(JSON.parse(String(r.phones)) as string[]), text(r.whatsapp)];
          return numbers.some((n) => n.replace(/\D/g, '').includes(digits));
        })
        .map((r) => ({ id: String(r.id), name: String(r.name), firstSite: text(r.first_site), followUpDue: Number(r.due) === 1 }));
    },

    archiveCustomer: (id: string) => db.update('customer', id, { archived_at: new Date().toISOString() }),
    unarchiveCustomer: (id: string) => db.update('customer', id, { archived_at: null }),

    /** Sets the date to follow up this Customer, replacing any open follow-up. */
    setFollowUp(customerId: string, dueDate: string) {
      if (!isAccountingDate(dueDate) || dueDate < today()) throw new InputError({ followUp: 'Pick today or a later day.' });
      db.transaction(() => {
        const open = db.get('SELECT id FROM follow_up WHERE customer_id = ? AND done_at IS NULL', [customerId]);
        if (open) db.update('follow_up', String(open.id), { due_date: dueDate });
        else db.insert('follow_up', { customer_id: customerId, due_date: dueDate });
      });
    },
  };
}

export type People = ReturnType<typeof people>;
