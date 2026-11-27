// The checks on every open (spec section 13): the ledger balances and the
// seven rules of spec section 6 hold. A failure is logged and the app shows a
// banner; nothing is changed and work is never blocked. A fix is a correcting
// entry, never an edit.
//
// Each check says which tables it needs. Until they exist the check waits, so
// tickets that add records only need to add or fill in a check here.
//
// Problems must name records by ID, tables by name and nothing else: no names,
// phone numbers, amounts or descriptions. They go into the error log and the
// problem report.
import { ACCOUNTS, type AccountCode } from '../core';
import type { Db } from '../db';

export type CheckOutcome = 'passed' | 'failed' | 'waiting';

export type CheckResult = {
  name: string;
  outcome: CheckOutcome;
  /** What was found, safe to show: IDs and table names only. */
  problems: string[];
  /** The records the problems are about. */
  recordIds: string[];
  /** Why a waiting check did not run. */
  waitingFor?: string;
};

export type CheckRun = { failed: boolean; results: CheckResult[] };

type Context = {
  /** Records per table now. */
  counts: Record<string, number>;
  /** Records per table at the last check, or null if there was none. */
  lastCounts: Record<string, number> | null;
};

type Check = {
  name: string;
  /** Tables the check reads; it waits until they all exist. */
  needs: readonly string[];
  /** Absent: the check waits for the ticket that builds what it checks. */
  run?: (db: Db, ctx: Context) => string[];
  waitingFor?: string;
};

/** Tables whose rows may go: logs that keep only their latest entries. */
const TRIMMED = new Set(['error_log', 'check_log']);
const CHECK_LOG_KEEP = 100;

type Line = { entry: string; account: string; customer: string | null; debit: number; credit: number };

function journalLines(db: Db): Line[] {
  return db
    .all('SELECT journal_entry_id, account_code, customer_id, debit, credit FROM journal_line ORDER BY rowid')
    .map((r) => ({
      entry: String(r.journal_entry_id),
      account: String(r.account_code),
      customer: r.customer_id === null ? null : String(r.customer_id),
      debit: Number(r.debit),
      credit: Number(r.credit),
    }));
}

const checks: readonly Check[] = [
  {
    name: 'Records file: sound, and every link points to a record',
    needs: [],
    run(db) {
      const problems: string[] = [];
      const quick = db.all('PRAGMA quick_check').map((r) => String(Object.values(r)[0]));
      if (quick.join() !== 'ok') problems.push('The records file failed its own check (quick_check).');
      for (const r of db.all('PRAGMA foreign_key_check')) {
        problems.push(`A record in ${String(r.table)} links to a missing record in ${String(r.parent)}.`);
      }
      return problems;
    },
  },
  {
    name: 'Ledger: debits equal credits',
    needs: ['journal_entry', 'journal_line'],
    run(db) {
      const problems: string[] = [];
      const sums = new Map<string, { debit: number; credit: number; lines: number }>();
      for (const l of journalLines(db)) {
        const s = sums.get(l.entry) ?? { debit: 0, credit: 0, lines: 0 };
        s.debit += l.debit;
        s.credit += l.credit;
        s.lines++;
        sums.set(l.entry, s);
        const account = ACCOUNTS[l.account as AccountCode];
        if (!account) problems.push(`Entry ${l.entry}: a line names an account that does not exist.`);
        else if (account.perCustomer && l.customer === null) {
          problems.push(`Entry ${l.entry}: a ${account.name} line names no Customer.`);
        }
      }
      let debits = 0;
      let credits = 0;
      for (const [id, s] of sums) {
        if (s.debit !== s.credit) problems.push(`Entry ${id}: its debits do not equal its credits.`);
        if (s.lines < 2) problems.push(`Entry ${id}: it has fewer than two lines.`);
        debits += s.debit;
        credits += s.credit;
      }
      if (debits !== credits) problems.push('The whole ledger: debits do not equal credits.');
      const empty = db.all(
        'SELECT id FROM journal_entry WHERE id NOT IN (SELECT journal_entry_id FROM journal_line) ORDER BY rowid',
      );
      for (const r of empty) problems.push(`Entry ${String(r.id)}: it has no lines.`);
      return problems;
    },
  },
  {
    name: 'Rule 1: net money received = money applied to active Invoices + unused Deposits + Credit',
    needs: ['payment', 'refund', 'allocation'],
    waitingFor: 'Payments, Deposits and Credit',
  },
  {
    name: 'Rule 2: balance owed = active Invoices + Opening balance items - money applied - Write-offs',
    needs: ['document', 'allocation', 'write_off', 'opening_balance_item'],
    waitingFor: 'Invoices and Payments',
  },
  {
    name: 'Rule 3: Deposits and Credit are held for the Customer, apart from debt',
    needs: ['allocation'],
    waitingFor: 'Deposits and Credit',
  },
  {
    name: 'Rule 4: no entry is zero or negative',
    needs: ['journal_line'],
    run: (db) =>
      journalLines(db)
        .filter((l) => l.debit < 0 || l.credit < 0 || l.debit > 0 === l.credit > 0)
        .map((l) => `Entry ${l.entry}: a line is zero, negative, or both a debit and a credit.`),
  },
  {
    name: 'Rule 5: a Payment, its split and its Receipt are saved together',
    needs: ['payment', 'allocation', 'document'],
    waitingFor: 'Payments and Receipts',
  },
  {
    name: 'Rule 6: applied Receipts, Quotations and Drafts never count as money received',
    needs: ['payment', 'document'],
    waitingFor: 'Payments and Receipts',
  },
  {
    name: 'Rule 7: nothing Issued or recorded is erased',
    needs: [],
    run(_db, { counts, lastCounts }) {
      if (!lastCounts) return [];
      return Object.entries(lastCounts)
        .filter(([table, before]) => !TRIMMED.has(table) && (counts[table] ?? 0) < before)
        .map(([table]) => `Records in ${table} are fewer than at the last check.`);
    },
  },
];

/** Records per table, for every table there is. */
export function recordCounts(db: Db): Record<string, number> {
  const tables = db
    .all("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map((r) => String(r.name));
  return Object.fromEntries(tables.map((t) => [t, Number(db.get(`SELECT count(*) AS n FROM "${t}"`)?.n)]));
}

function lastCounts(db: Db, tables: Record<string, number>): Record<string, number> | null {
  if (!('check_log' in tables)) return null;
  const row = db.get('SELECT counts FROM check_log ORDER BY rowid DESC LIMIT 1');
  return row ? (JSON.parse(String(row.counts)) as Record<string, number>) : null;
}

const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Runs every check. Reads only; changes nothing. */
export function runChecks(db: Db): CheckResult[] {
  let ctx: Context;
  try {
    const counts = recordCounts(db);
    ctx = { counts, lastCounts: lastCounts(db, counts) };
  } catch {
    ctx = { counts: {}, lastCounts: null };
  }
  return checks.map((check): CheckResult => {
    const missing = check.needs.filter((t) => !(t in ctx.counts));
    if (!check.run || missing.length > 0) {
      return {
        name: check.name,
        outcome: 'waiting',
        problems: [],
        recordIds: [],
        waitingFor: check.waitingFor ?? `no ${missing.join(', ')} records yet`,
      };
    }
    let problems: string[];
    try {
      problems = check.run(db, ctx);
    } catch {
      problems = ['The check could not run on these records.'];
    }
    const recordIds = [...new Set(problems.flatMap((p) => p.match(ID) ?? []))];
    return { name: check.name, outcome: problems.length ? 'failed' : 'passed', problems, recordIds };
  });
}

/**
 * The checks on open: runs them, keeps the result in the check log and logs
 * each failure. Never throws and never blocks work.
 */
export function checkOnOpen(db: Db): CheckRun {
  let results: CheckResult[];
  try {
    results = runChecks(db);
  } catch (e) {
    db.logError('checks on open', e);
    return { failed: true, results: [] };
  }
  const failed = results.some((r) => r.outcome === 'failed');
  for (const r of results.filter((x) => x.outcome === 'failed')) {
    const records = r.recordIds.length ? `; records ${r.recordIds.join(', ')}` : '';
    db.logError('checks on open', `${r.name}: ${r.problems.length} problem(s)${records}`);
  }
  try {
    db.transaction(() => {
      db.insert('check_log', {
        app_version: db.appVersion,
        db_version: db.version,
        failed: failed ? 1 : 0,
        results: JSON.stringify(results.map((r) => ({ name: r.name, outcome: r.outcome, problems: r.problems.length }))),
        counts: JSON.stringify(recordCounts(db)),
      });
      db.run(
        `DELETE FROM check_log WHERE rowid NOT IN (SELECT rowid FROM check_log ORDER BY rowid DESC LIMIT ${CHECK_LOG_KEEP})`,
      );
    });
  } catch (e) {
    db.logError('checks on open: check log', e);
  }
  return { failed, results };
}
