// The database checks. Plain functions over a SqlPlatform, so the same checks
// run under Vitest on Node's SQLite (database.test.ts) and inside the `.test`
// app on the real expo-sqlite in the emulator job (selfTest.ts).
import { openDatabase, type Db, type OpenOptions } from './database';
import { recordColumns, steps as appSteps, type Step } from './steps';
import type { SqlPlatform } from './sql';
import { noAddress, people, type CustomerDetails } from '../people';
import { documents } from '../documents';
import { customerOwes } from '../ledger';
import { payments } from '../payments';
import { emptyBusiness, saveBusinessDetails, startNew } from '../setup/store';

export type DbCheck = { name: string; run: (platform: SqlPlatform) => void };

class CheckFailed extends Error {}

function same<T>(actual: T, expected: T, what: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new CheckFailed(`${what}: expected ${e}, got ${a}`);
}

function yes(value: boolean, what: string) {
  if (!value) throw new CheckFailed(what);
}

// Different bytes on every call, as a real random source gives.
let counter = 0;
function countingBytes(n: number): Uint8Array {
  let c = ++counter;
  const bytes = new Uint8Array(n);
  for (let i = n - 1; i >= 0; i--) {
    bytes[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return bytes;
}

const fixed = (platform: SqlPlatform, more: Partial<OpenOptions> = {}): OpenOptions => ({
  platform,
  appVersion: '1.0.0',
  clock: () => Date.UTC(2026, 10, 27, 12, 0, 0),
  random: countingBytes,
  ...more,
});

export const dbChecks: DbCheck[] = [
  {
    name: 'a first open makes the records at the latest version with an install ID',
    run(platform) {
      const opened = openDatabase(fixed(platform));
      yes(opened.ok, 'opens');
      if (!opened.ok) return;
      const { db } = opened;
      same(db.version, db.latestVersion, 'version');
      yes(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(db.installId), 'install ID is a UUID v7');
      db.close();
      const again = openDatabase(fixed(platform));
      yes(again.ok && again.db.installId === db.installId, 'the install ID stays the same on the next open');
      if (again.ok) again.db.close();
    },
  },
];

// Test steps on top of the app's first step: 2 adds a note table, 3 adds a
// column, `broken` changes something and then fails.
const base = appSteps[0]!;
const addNotes: Step = {
  to: 2,
  name: 'notes',
  run: (ctx) => ctx.exec(`CREATE TABLE note (${recordColumns()}, text TEXT NOT NULL) STRICT;`),
};
const addColour: Step = { to: 3, name: 'colour', run: (ctx) => ctx.exec('ALTER TABLE note ADD COLUMN colour TEXT;') };
const broken = (to: number): Step => ({
  to,
  name: 'broken',
  run(ctx) {
    ctx.exec('CREATE TABLE half_done (x INTEGER) STRICT;');
    throw new Error("step broke on 'Mr Secret Customer'");
  },
});

function open(platform: SqlPlatform, steps: readonly Step[]) {
  const opened = openDatabase(fixed(platform, { steps }));
  if (!opened.ok) throw new CheckFailed(`open failed: ${opened.problem}`);
  return opened;
}

const tables = (db: Db) => db.all("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").map((r) => r.name);

dbChecks.push(
  {
    name: 'an older database is upgraded step by step and keeps its records',
    run(platform) {
      const v1 = open(platform, [base]).db;
      const installId = v1.installId;
      v1.close();
      const v2 = open(platform, [base, addNotes]).db;
      const id = v2.insert('note', { text: 'kept' });
      v2.close();
      const v3 = open(platform, [base, addNotes, addColour]);
      same(v3.upgraded, { from: 2, to: 3 }, 'upgraded');
      same(v3.db.version, 3, 'version');
      same(v3.db.installId, installId, 'install ID');
      same(v3.db.get('SELECT text, colour FROM note WHERE id = ?', [id]), { text: 'kept', colour: null }, 'record');
      same(
        v3.db.upgradeLog().map((e) => [e.from, e.to, e.result]),
        [[0, 1, 'done'], [1, 2, 'done'], [2, 3, 'done']],
        'upgrade log',
      );
      v3.db.close();
    },
  },
  {
    name: 'a failing step returns to the safety copy, undoing earlier steps of the same upgrade, and says so',
    run(platform) {
      const v1 = open(platform, [base]).db;
      v1.close();
      const v2 = open(platform, [base, addNotes]).db;
      const id = v2.insert('note', { text: 'kept' });
      v2.close();
      const opened = openDatabase(fixed(platform, { steps: [base, addNotes, addColour, broken(4)] }));
      yes(!opened.ok && opened.problem === 'returned-to-copy', 'returns to the copy');
      if (opened.ok || !opened.db) return;
      const { db } = opened;
      yes(opened.message.includes('put them back as they were'), 'says so in plain words');
      same(db.version, 2, 'version is the one before the upgrade');
      same(db.get('PRAGMA user_version'), { user_version: 2 }, 'file version');
      same(tables(db).includes('half_done'), false, 'the broken step left nothing');
      yes(!(db.all('PRAGMA table_info(note)').some((c) => c.name === 'colour')), 'step 3, which worked, was undone too');
      same(db.get('SELECT text FROM note WHERE id = ?', [id]), { text: 'kept' }, 'record');
      const last = db.upgradeLog().at(-1)!;
      same([last.from, last.to], [2, 4], 'upgrade log names the upgrade');
      yes(last.result.startsWith('failed at step 4; returned to the safety copy'), `upgrade log result: ${last.result}`);
      const err = db.errorLog().at(-1)!;
      same(err.place, 'upgrade: step 4', 'error log place');
      yes(!err.error.includes('Secret'), 'error log leaves out quoted record contents');
      db.close();
      const again = open(platform, [base, addNotes]);
      same(again.upgraded, null, 'the records open as before with the old steps');
      again.db.close();
    },
  },
  {
    name: 'records from a newer Mhizha are refused, not touched',
    run(platform) {
      open(platform, [base, addNotes]).db.close();
      const opened = openDatabase(fixed(platform, { steps: [base] }));
      yes(!opened.ok && opened.problem === 'too-new', 'refused');
      opened.db?.close();
      const again = open(platform, [base, addNotes]);
      same(again.db.version, 2, 'still version 2');
      again.db.close();
    },
  },
  {
    name: 'a failed first open leaves nothing behind, so the next open starts clean',
    run(platform) {
      const opened = openDatabase(fixed(platform, { steps: [base, broken(2)] }));
      yes(!opened.ok && opened.problem === 'failed', 'fails');
      const again = open(platform, [base, addNotes]);
      same(again.upgraded, { from: 0, to: 2 }, 'starts from nothing');
      again.db.close();
    },
  },
  {
    name: 'no upgrade happens if the safety copy cannot be made',
    run(platform) {
      open(platform, [base]).db.close();
      const noCopies: SqlPlatform = {
        ...platform,
        pathOf: (n) => (n.endsWith('.before-upgrade') ? `${platform.pathOf('missing-folder')}/x/${n}` : platform.pathOf(n)),
      };
      const opened = openDatabase(fixed(noCopies, { steps: [base, addNotes] }));
      yes(!opened.ok && opened.problem === 'copy-failed', 'refuses to upgrade');
      if (opened.ok || !opened.db) return;
      same(opened.db.version, 1, 'still version 1');
      same(tables(opened.db).includes('note'), false, 'no step ran');
      same(opened.db.errorLog().at(-1)?.place, 'upgrade: safety copy', 'logged');
      opened.db.close();
    },
  },
);

// Test steps for record rules: a parent and a child that must name one.
const family: Step = {
  to: 2,
  name: 'family',
  run: (ctx) =>
    ctx.exec(`
CREATE TABLE parent (${recordColumns()}, label TEXT NOT NULL) STRICT;
CREATE TABLE child (${recordColumns()}, parent_id TEXT NOT NULL REFERENCES parent (id)) STRICT;`),
};

const uuid7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function throws(fn: () => unknown, what: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new CheckFailed(`${what}: expected an error`);
}

dbChecks.push(
  {
    name: 'every record gets a UUID v7, the install ID, both times and a change counter',
    run(platform) {
      let ms = Date.UTC(2026, 10, 27, 12, 0, 0);
      const opened = openDatabase(fixed(platform, { steps: [base, family], clock: () => ms }));
      if (!opened.ok) throw new CheckFailed('opens');
      const { db } = opened;
      const id = db.insert('parent', { label: 'a' });
      yes(uuid7.test(id), 'ID is a UUID v7');
      same(
        db.get('SELECT install_id, created_at, changed_at, change_count FROM parent WHERE id = ?', [id]),
        { install_id: db.installId, created_at: '2026-11-27T12:00:00.000Z', changed_at: '2026-11-27T12:00:00.000Z', change_count: 0 },
        'new record',
      );
      ms += 60_000;
      db.update('parent', id, { label: 'b' });
      db.update('parent', id, { label: 'c' });
      same(
        db.get('SELECT label, created_at, changed_at, change_count FROM parent WHERE id = ?', [id]),
        { label: 'c', created_at: '2026-11-27T12:00:00.000Z', changed_at: '2026-11-27T12:01:00.000Z', change_count: 2 },
        'changed record',
      );
      throws(() => db.update('parent', 'no-such-id', { label: 'x' }), 'changing a missing record');
      throws(() => db.insert('parent; DROP TABLE parent', { label: 'x' }), 'a table name that is not a name');
      db.close();
    },
  },
  {
    name: 'links to records that do not exist are refused',
    run(platform) {
      const { db } = open(platform, [base, family]);
      const parent = db.insert('parent', { label: 'a' });
      db.insert('child', { parent_id: parent });
      throws(() => db.insert('child', { parent_id: '00000000-0000-7000-8000-000000000000' }), 'a link to nothing');
      db.close();
    },
  },
  {
    name: 'an action touching several records saves all of them or none',
    run(platform) {
      const { db } = open(platform, [base, family]);
      throws(
        () =>
          db.transaction(() => {
            const p = db.insert('parent', { label: 'a' });
            db.transaction(() => db.insert('child', { parent_id: p }));
            throw new Error('stop');
          }),
        'the action fails',
      );
      same(db.get('SELECT count(*) AS n FROM parent'), { n: 0 }, 'nothing saved');
      db.transaction(() => {
        const p = db.insert('parent', { label: 'a' });
        db.insert('child', { parent_id: p });
      });
      same(db.get('SELECT count(*) AS n FROM child'), { n: 1 }, 'all saved');
      db.close();
    },
  },
  {
    name: 'the error log keeps the last 500 entries, with versions and no quoted contents',
    run(platform) {
      const { db } = open(platform, [base]);
      for (let i = 1; i <= 505; i++) db.logError('customers', new Error(`failed ${i} on "Jane's Plumbing"`));
      const log = db.errorLog();
      same(log.length, 500, 'entries kept');
      same(log[0]!.error, 'Error: failed 6 on "…"', 'oldest kept, quoted text removed');
      same([log[0]!.place, log[0]!.appVersion, log[0]!.dbVersion], ['customers', '1.0.0', 1], 'place and versions');
      db.close();
    },
  },
);

dbChecks.push({
  name: 'Price list items keep whole cents and refuse negative or part-cent prices and empty names',
  run(platform) {
    const { db } = open(platform, appSteps);
    const id = db.insert('price_list_item', { name: 'Labour', unit: 'day', unit_price: 4500 });
    same(db.get('SELECT unit_price, deleted_at FROM price_list_item WHERE id = ?', [id]), { unit_price: 4500, deleted_at: null }, 'saved');
    throws(() => db.insert('price_list_item', { name: 'x', unit: '', unit_price: -1 }), 'a negative price');
    throws(() => db.insert('price_list_item', { name: 'x', unit: '', unit_price: 1.5 }), 'a part-cent price');
    throws(() => db.insert('price_list_item', { name: ' ', unit: '', unit_price: 1 }), 'an empty name');
    db.close();
  },
});

dbChecks.push({
  name: "Customers, Sites and Jobs save as one unit, keep a Job at its own Customer's Site, and are never deleted",
  run(platform) {
    const { db } = open(platform, appSteps);
    const p = people(db, () => '2026-11-27');
    const details: CustomerDetails = { kind: 'person', name: '', phones: ['077 123 4567'], whatsapp: '', email: '', address: noAddress, taxNumber: '' };
    const c = p.addCustomer({ ...details, name: 'Test Customer', firstSiteName: 'House', note: 'A note' });
    const other = p.addCustomer({ ...details, name: 'Other Customer', firstSiteName: '', note: '' });
    const site = p.sites(c)[0]!.id;
    same(p.sites(c).map((s) => s.name), ['House'], 'the first Site');
    const job = p.addJob(c, { title: 'Work', siteId: site });
    throws(() => p.addJob(other, { title: 'Work', siteId: site }), "a Job at another Customer's Site");
    throws(() => p.markDone(job, '2026-11-28'), 'a finish date after today');
    p.markDone(job, '2026-11-27');
    same(p.job(job).status, 'done', 'Done');
    throws(() => db.run('DELETE FROM customer'), 'a deleted Customer');
    throws(() => db.run('DELETE FROM job'), 'a deleted Job');
    same(p.customers().length, 2, 'Customers kept');
    db.close();
  },
});

dbChecks.push({
  name: 'an Invoice issues with the next number, locks, and posts Customers owe and Sales in the same save',
  run(platform) {
    const { db } = open(platform, appSteps);
    startNew(db, '2026-11-27');
    saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-11-27');
    const p = people(db, () => '2026-11-27');
    const c = p.addCustomer({
      kind: 'person', name: 'Test Customer', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const job = p.addJob(c, { title: 'Work', siteId: p.sites(c)[0]!.id });
    const d = documents(db, () => Date.UTC(2026, 10, 27, 12, 0, 0));
    const id = d.newInvoice(c);
    d.setJob(id, job);
    d.setLines(id, [{ priceListItemId: null, description: 'Labour', unit: 'day', quantity: 2000, unitPrice: 4500 }]);
    d.setDiscount(id, { kind: 'percent', tenths: 100 });
    same(d.issue(id), 'INV-0001', 'the number');
    same([d.issued(id).total, customerOwes(db, c)], [8100, 8100], 'the Total and what the Customer owes');
    throws(() => db.run('UPDATE document SET total = 1 WHERE id = ?', [id]), 'a change to an Issued Invoice');
    throws(() => db.run('DELETE FROM journal_line'), 'a deleted entry');
    db.close();
  },
});

dbChecks.push({
  name: 'a Quotation issues and posts nothing; a Revision keeps its number; an answer is a fact; an Invoice from it takes its Discount share',
  run(platform) {
    const { db } = open(platform, appSteps);
    startNew(db, '2026-11-27');
    saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-11-27');
    const p = people(db, () => '2026-11-27');
    const c = p.addCustomer({
      kind: 'person', name: 'Test Customer', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const job = p.addJob(c, { title: 'Work', siteId: p.sites(c)[0]!.id });
    const d = documents(db, () => Date.UTC(2026, 10, 27, 12, 0, 0));
    const q = d.newQuotation(c);
    d.setJob(q, job);
    d.setLines(q, [
      { priceListItemId: null, description: 'Labour', unit: 'day', quantity: 4000, unitPrice: 4500 },
      { priceListItemId: null, description: 'Cable', unit: 'm', quantity: 100000, unitPrice: 200 },
    ]);
    d.setDiscount(q, { kind: 'amount', cents: 1000 });
    d.setTerms(q, { validUntil: null, depositAsked: 15000, leadTime: '2 weeks' });
    same(d.issue(q), 'QUO-0001', 'the number');
    same([customerOwes(db, c), db.get('SELECT count(*) AS n FROM journal_entry')?.n], [0, 0], 'a Quotation posts nothing');
    throws(() => db.run("UPDATE document SET lead_time = 'x' WHERE id = ?", [q]), 'a change to an Issued Quotation');
    const rev = d.revise(q);
    same(d.issue(rev), 'QUO-0001 Rev 2', 'the Revision keeps the number');
    same(d.quotation(q).status, 'superseded', 'the older version');
    d.accept(rev, '2026-11-27');
    throws(() => db.run('DELETE FROM quotation_event'), 'a deleted answer');
    const inv = d.invoiceFrom(rev);
    d.setLines(inv, [{ priceListItemId: null, description: 'Labour', unit: 'day', quantity: 4000, unitPrice: 4500 }]);
    same(d.draft(inv).totals.discount, 474, 'the Invoice takes its share of the Discount');
    same(d.issue(inv), 'INV-0001', 'the Invoice number');
    same([customerOwes(db, c), d.quotation(rev).remaining], [17526, 19474], 'what is owed and what remains (Total 370.00 less 175.26)');
    db.close();
  },
});

dbChecks.push({
  name: 'a Payment saves with its Receipt, split and ledger entry in one save, or not at all',
  run(platform) {
    const { db } = open(platform, appSteps);
    startNew(db, '2026-11-27');
    saveBusinessDetails(db, { ...emptyBusiness(), name: 'Demo Building Services' }, '2026-11-27');
    const p = people(db, () => '2026-11-27');
    const c = p.addCustomer({
      kind: 'person', name: 'Test Customer', phones: [], whatsapp: '', email: '', address: noAddress, taxNumber: '', firstSiteName: '', note: '',
    });
    const job = p.addJob(c, { title: 'Work', siteId: p.sites(c)[0]!.id });
    const clock = () => Date.UTC(2026, 10, 27, 12, 0, 0);
    const d = documents(db, clock);
    const inv = d.newInvoice(c);
    d.setJob(inv, job);
    d.setLines(inv, [{ priceListItemId: null, description: 'Labour', unit: '', quantity: 1000, unitPrice: 10000 }]);
    d.issue(inv);
    const pay = payments(db, clock);
    const input = {
      customerId: c, amount: 4000, dateReceived: '2026-11-27', method: 'cash' as const, otherDescription: '',
      parts: [{ invoiceId: inv, amount: 4000 }], separate: false,
    };
    db.run("CREATE TRIGGER fail_lines BEFORE INSERT ON receipt_line BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
    throws(() => pay.record(input), 'a save that fails half way');
    same([db.get('SELECT count(*) AS n FROM payment')?.n, customerOwes(db, c)], [0, 10000], 'nothing saved');
    db.run('DROP TRIGGER fail_lines');
    const [receipt] = pay.record(input);
    same([pay.receipt(receipt!).number, customerOwes(db, c), d.issued(inv).status], ['REC-0001', 6000, 'part-paid'], 'saved');
    throws(() => db.run('DELETE FROM payment'), 'a deleted Payment');
    db.close();
  },
});
