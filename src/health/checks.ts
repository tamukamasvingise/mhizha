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
import { ACCOUNT, ACCOUNTS, MONEY_ACCOUNTS, type AccountCode } from '../core';
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

/** Not reversed, and not itself a reversal. */
const LIVE = (a: string) =>
  `${a}.reverses_id IS NULL AND NOT EXISTS (SELECT 1 FROM allocation x WHERE x.reverses_id = ${a}.id)`;

/** Each Customer's balance on a held account in the ledger, as the Business owes it. */
function heldInLedger(db: Db, account: AccountCode): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of db.all(
    `SELECT customer_id AS c, coalesce(sum(credit), 0) - coalesce(sum(debit), 0) AS n FROM journal_line
     WHERE account_code = ? GROUP BY customer_id`,
    [account],
  )) {
    out.set(String(r.c), Number(r.n));
  }
  return out;
}

/** Adds up what is left per Customer; a use above what was held makes the Customer's total NaN, so it never agrees. */
function leftPerCustomer(rows: readonly Readonly<Record<string, unknown>>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const left = Number(r.left);
    out.set(String(r.c), left < 0 ? Number.NaN : (out.get(String(r.c)) ?? 0) + left);
  }
  return out;
}

function disagreeing(records: Map<string, number>, ledger: Map<string, number>): string[] {
  return [...new Set([...records.keys(), ...ledger.keys()])].filter((c) => (records.get(c) ?? 0) !== (ledger.get(c) ?? 0));
}

function depositsAgree(db: Db): string[] {
  const records = leftPerCustomer(
    db.all(
      `SELECT q.customer_id AS c, a.amount - (SELECT coalesce(sum(u.amount), 0) FROM allocation u
         WHERE u.from_kind = 'deposit' AND u.from_id = a.id AND ${LIVE('u')}) AS left
       FROM allocation a JOIN document q ON q.id = a.to_id
       WHERE a.from_kind IN ('payment', 'opening-credit') AND a.to_kind = 'quotation' AND ${LIVE('a')}`,
    ),
  );
  return disagreeing(records, heldInLedger(db, ACCOUNT.depositsHeld)).map(
    (c) => `Customer ${c}: Deposits held in the ledger do not agree with the Deposits on their Quotations.`,
  );
}

function creditAgrees(db: Db): string[] {
  const rows = db.all(
    `SELECT a.to_id AS c, a.amount - (SELECT coalesce(sum(u.amount), 0) FROM allocation u
       WHERE u.from_kind = 'credit' AND u.from_id = a.id AND ${LIVE('u')}) AS left
     FROM allocation a
     WHERE a.to_kind = 'credit' AND a.from_kind IN ('payment', 'deposit') AND ${LIVE('a')}`,
  );
  // Credit held on the Start date: what is left of each Opening balance item of Credit not Cancelled.
  if (db.get("SELECT 1 AS x FROM sqlite_schema WHERE type = 'table' AND name = 'opening_balance_item'")) {
    rows.push(
      ...db.all(
        `SELECT o.customer_id AS c, o.amount - (SELECT coalesce(sum(u.amount), 0) FROM allocation u
           WHERE u.from_kind = 'opening-credit' AND u.from_id = o.id AND ${LIVE('u')}) AS left
         FROM opening_balance_item o WHERE o.kind = 'credit' AND o.cancelled_on IS NULL`,
      ),
    );
  }
  return disagreeing(leftPerCustomer(rows), heldInLedger(db, ACCOUNT.creditHeld)).map(
    (c) => `Customer ${c}: Credit held in the ledger does not agree with the Credit in their records.`,
  );
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
    needs: ['payment', 'refund', 'allocation', 'journal_line'],
    // Valid Payments less valid Refunds is what the money accounts hold, and
    // each Refund paid back exactly what it took from Deposits or Credit. (Each
    // Payment's split adding up to it is Rule 5; uses never above what is held, Rule 3.)
    run(db) {
      const problems: string[] = [];
      for (const r of db.all(
        `SELECT f.id, f.amount, (SELECT coalesce(sum(a.amount), 0) FROM allocation a
           WHERE a.to_kind = 'refund' AND a.to_id = f.document_id AND ${LIVE('a')}) AS used
         FROM refund f ORDER BY f.rowid`,
      )) {
        if (Number(r.used) !== Number(r.amount)) problems.push(`Refund ${String(r.id)}: what it paid back from does not add up to it.`);
      }
      const paid = Number(db.get('SELECT coalesce(sum(amount), 0) AS n FROM payment')?.n);
      const refunded = Number(db.get('SELECT coalesce(sum(amount), 0) AS n FROM refund')?.n);
      const held = Number(
        db.get(
          `SELECT coalesce(sum(debit), 0) - coalesce(sum(credit), 0) AS n FROM journal_line
           WHERE account_code IN (${MONEY_ACCOUNTS.map(() => '?').join(', ')})`,
          [...MONEY_ACCOUNTS],
        )?.n,
      );
      if (held !== paid - refunded) problems.push('The money accounts in the ledger do not agree with Payments less Refunds.');
      return problems;
    },
  },
  {
    name: 'Rule 2: balance owed = active Invoices + Opening balance items - money applied - Write-offs',
    needs: ['document', 'allocation', 'write_off', 'opening_balance_item'],
    waitingFor: 'Invoices and Payments',
  },
  {
    name: 'Rule 3: Deposits and Credit are held for the Customer, apart from debt',
    needs: ['allocation', 'payment', 'document', 'journal_line'],
    // Each Customer's Deposits held in the ledger is the unused part of the
    // Deposits paid on their Quotations, and their Credit held is the unused
    // part of their Credit (overpayments and Deposits moved to Credit, and
    // Opening balance items of Credit once those records exist). A use above
    // what a Deposit or Credit holds fails too.
    run(db) {
      return [...depositsAgree(db), ...creditAgrees(db)];
    },
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
    needs: ['payment', 'allocation', 'document', 'receipt_line'],
    run(db) {
      const problems: string[] = [];
      for (const r of db.all(
        `SELECT p.id, p.amount, d.total, d.number,
           (SELECT coalesce(sum(amount), 0) FROM allocation WHERE from_kind = 'payment' AND from_id = p.id AND reverses_id IS NULL) AS split,
           (SELECT coalesce(sum(amount), 0) FROM receipt_line WHERE receipt_id = p.receipt_id) AS printed,
           (SELECT count(*) FROM journal_entry WHERE id = p.journal_entry_id) AS entries
         FROM payment p LEFT JOIN document d ON d.id = p.receipt_id AND d.type = 'REC' ORDER BY p.rowid`,
      )) {
        const id = String(r.id);
        if (r.number == null) problems.push(`Payment ${id}: it has no Issued Receipt.`);
        else if (Number(r.total) !== Number(r.amount)) problems.push(`Payment ${id}: its Receipt shows another amount.`);
        if (Number(r.split) !== Number(r.amount)) problems.push(`Payment ${id}: what it paid does not add up to it.`);
        if (Number(r.printed) !== Number(r.amount)) problems.push(`Payment ${id}: its Receipt lines do not add up to it.`);
        if (Number(r.entries) !== 1) problems.push(`Payment ${id}: it has no ledger entry.`);
      }
      return problems;
    },
  },
  {
    name: 'Rule 6: applied Receipts, Quotations and Drafts never count as money received',
    needs: ['payment', 'document', 'journal_entry', 'journal_line'],
    // Money comes in only on a money Receipt: an entry that adds to a money
    // account and comes from a Receipt with no Payment, or from a Quotation
    // or a Draft, counts money that was never received.
    run: (db) =>
      db
        .all(
          `SELECT DISTINCT e.id FROM journal_entry e JOIN journal_line l ON l.journal_entry_id = e.id
           JOIN document d ON d.id = e.source_id
           WHERE l.debit > 0 AND l.account_code IN (${MONEY_ACCOUNTS.map(() => '?').join(', ')})
             AND (d.type = 'QUO' OR d.number IS NULL
               OR (d.type = 'REC' AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.receipt_id = d.id)))
           ORDER BY e.rowid`,
          [...MONEY_ACCOUNTS],
        )
        .map((r) => `Entry ${String(r.id)}: it counts money received for a Document that received none.`),
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
