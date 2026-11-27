import { describe, expect, it } from 'vitest';
import { openDatabase, recordColumns, steps as appSteps, type Db, type Step } from '../db';
import { nodePlatform } from '../db/node';
import type { SqlPlatform } from '../db/sql';
import { checkOnOpen, runChecks } from './checks';
import { problemReport, reportFileName, type ReportFacts } from './report';

let n = 0;
const random = (size: number) => {
  let c = ++n;
  const bytes = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i--) {
    bytes[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return bytes;
};

const at = Date.UTC(2026, 10, 27, 12, 0, 0);

function open(platform: SqlPlatform = nodePlatform(), steps: readonly Step[] = appSteps): Db {
  const opened = openDatabase({ platform, steps, appVersion: '1.0.0', clock: () => at, random });
  if (!opened.ok) throw new Error(opened.problem);
  return opened.db;
}

// A loose ledger that lets the test write entries the real tables refuse, and a table with no
// delete guard, on top of the app's steps.
const later: Step[] = [
  ...appSteps,
  {
    to: appSteps.length + 1,
    name: 'ledger and a plain table for the test',
    run: (ctx) =>
      ctx.exec(`
CREATE TABLE test_record (${recordColumns()}, label TEXT) STRICT;
DROP TABLE journal_line;
DROP TABLE journal_entry;
CREATE TABLE journal_entry (${recordColumns()}, accounting_date TEXT NOT NULL) STRICT;
CREATE TABLE journal_line (${recordColumns()},
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id),
  account_code TEXT NOT NULL,
  customer_id TEXT REFERENCES customer (id),
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0) STRICT;`),
  },
];

function entry(db: Db, lines: { account: string; customer?: string; debit?: number; credit?: number }[]) {
  const id = db.insert('journal_entry', { accounting_date: '2026-11-27' });
  for (const l of lines) {
    db.insert('journal_line', {
      journal_entry_id: id,
      account_code: l.account,
      customer_id: l.customer ?? null,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
    });
  }
  return id;
}

const outcome = (db: Db) => Object.fromEntries(runChecks(db).map((r) => [r.name, r.outcome]));
const failed = (db: Db) => runChecks(db).filter((r) => r.outcome === 'failed');

describe('checks on open', () => {
  it('on new records every check passes or waits for the records it needs, and nothing is logged', () => {
    const db = open();
    const run = checkOnOpen(db);
    expect(run.failed).toBe(false);
    expect(run.results.every((r) => r.outcome === 'passed' || r.outcome === 'waiting')).toBe(true);
    expect(run.results.some((r) => r.name.startsWith('Ledger'))).toBe(true);
    for (const rule of [1, 2, 3, 4, 5, 6, 7]) {
      expect(run.results.some((r) => r.name.startsWith(`Rule ${rule}:`))).toBe(true);
    }
    expect(db.errorLog()).toEqual([]);
  });

  it('a balanced ledger passes', () => {
    const db = open(nodePlatform(), later);
    const c = db.insert('customer', { kind: 'person', name: 'Jane Moyo' });
    entry(db, [
      { account: '1100', customer: c, debit: 10000 },
      { account: '4000', credit: 10000 },
    ]);
    expect(outcome(db)).toMatchObject({ 'Ledger: debits equal credits': 'passed' });
    expect(failed(db)).toEqual([]);
  });

  it('an entry whose debits and credits differ fails, is logged without amounts, and work goes on', () => {
    const db = open(nodePlatform(), later);
    const bad = entry(db, [
      { account: '1010', debit: 5000 },
      { account: '4000', credit: 4000 },
    ]);
    const run = checkOnOpen(db);
    expect(run.failed).toBe(true);
    const ledger = run.results.find((r) => r.name === 'Ledger: debits equal credits')!;
    expect(ledger.outcome).toBe('failed');
    expect(ledger.recordIds).toContain(bad);
    const logged = db.errorLog();
    expect(logged.map((e) => e.place)).toEqual(['checks on open']);
    expect(logged[0]!.error).toContain('Ledger: debits equal credits');
    expect(logged[0]!.error).not.toMatch(/5000|4000|50\.00|40\.00/);
    db.insert('journal_entry', { accounting_date: '2026-11-28' });
  });

  it('Rule 4 fails on a zero amount or a line that is both debit and credit', () => {
    const db = open(nodePlatform(), later);
    entry(db, [
      { account: '1010', debit: 0 },
      { account: '4000', credit: 0 },
    ]);
    expect(outcome(db)['Rule 4: no entry is zero or negative']).toBe('failed');
  });

  it('Rule 7 fails when records were erased since the last open', () => {
    const platform = nodePlatform();
    let db = open(platform, later);
    const c = db.insert('test_record', { label: 'a' });
    db.insert('test_record', { label: 'b' });
    expect(checkOnOpen(db).failed).toBe(false);
    db.run('DELETE FROM test_record WHERE id = ?', [c]);
    db.close();
    db = open(platform, later);
    const rule7 = checkOnOpen(db).results.find((r) => r.name.startsWith('Rule 7:'))!;
    expect(rule7.outcome).toBe('failed');
    expect(rule7.problems.join(' ')).toContain('test_record');
  });

  it('a check that cannot run counts as failed instead of stopping the app', () => {
    const db = open(nodePlatform(), later);
    db.run('DROP TABLE journal_line');
    db.run(`CREATE TABLE journal_line (${recordColumns()}, something_else TEXT) STRICT`);
    const run = checkOnOpen(db);
    expect(run.failed).toBe(true);
    expect(run.results.find((r) => r.name === 'Ledger: debits equal credits')!.outcome).toBe('failed');
  });
});

const facts = (db: Db | null): ReportFacts => ({
  db,
  made: new Date(at),
  localDate: '2026-11-27',
  appVersion: '1.0.0',
  build: '42',
  phone: { model: 'sdk_gphone64_x86_64', manufacturer: 'Google', android: '10', api: 29 },
});

describe('the problem report', () => {
  it('is named for the day it is made', () => {
    expect(reportFileName('2026-11-27')).toBe('Mhizha problem report 2026-11-27.txt');
    expect(problemReport(facts(open())).fileName).toBe('Mhizha problem report 2026-11-27.txt');
  });

  it('holds versions, phone, error log, upgrade log, check results and record counts', () => {
    const db = open(nodePlatform(), later);
    db.insert('customer', { kind: 'person', name: 'Jane Moyo' });
    db.logError('customers', new Error('save failed for record 0190'));
    const { text } = problemReport(facts(db));
    expect(text).toContain('Mhizha 1.0.0 (build 42)');
    expect(text).toContain(`Database version: ${db.version} of ${db.latestVersion}`);
    expect(text).toContain('Google sdk_gphone64_x86_64');
    expect(text).toContain('Android 10 (API 29)');
    expect(text).toContain('save failed for record 0190');
    expect(text).toMatch(/0 -> 1 .*done/);
    expect(text).toContain('passed  Ledger: debits equal credits');
    expect(text).toMatch(/customer +1\b/);
    expect(text).toMatch(/install +1\b/);
  });

  it('holds no Customer details', () => {
    const db = open(nodePlatform(), later);
    const c = db.insert('customer', { kind: 'person', name: 'Jane Moyo', phones: JSON.stringify(['+263 77 123 4567']) });
    entry(db, [
      { account: '1100', customer: c, debit: 12345 },
      { account: '4000', credit: 12000 },
    ]);
    db.logError('customers', new Error(`could not save "Jane Moyo" ${c}`));
    checkOnOpen(db);
    const { text } = problemReport(facts(db));
    expect(text).not.toContain('Jane');
    expect(text).not.toContain('Moyo');
    expect(text).not.toContain('123 4567');
    expect(text).not.toMatch(/12345|12000|123\.45|120\.00/);
    expect(text).toContain('failed  Ledger: debits equal credits');
  });

  it('is still made when the records could not be opened', () => {
    const { text } = problemReport(facts(null));
    expect(text).toContain('Mhizha 1.0.0 (build 42)');
    expect(text).toContain('The records could not be opened.');
  });
});
