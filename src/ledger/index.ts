// The journal kept in the records (spec section 9). Every money event posts
// through `postEntry`, inside the same save as its Document: the core checks
// the entry against the whole journal, then it is written. Entries are never
// changed or deleted; the database refuses both.
import { ACCOUNT, post, reverse, type AccountCode, type Cents, type Entry, type EntryInput, type Journal } from '../core';
import type { Db } from '../db';
import { TIME_ZONE } from '../setup/dates';

/** Every entry ever posted, oldest first, as the core reads them. */
export function readJournal(db: Db): Journal {
  const entries = new Map<string, Entry>();
  for (const r of db.all(
    'SELECT id, accounting_date, recorded_at, source_kind, source_id, reverses_id FROM journal_entry ORDER BY rowid',
  )) {
    const e: Entry = {
      id: String(r.id),
      accountingDate: String(r.accounting_date),
      recordedAt: String(r.recorded_at),
      source: { kind: String(r.source_kind), id: String(r.source_id) },
      lines: [],
    };
    if (r.reverses_id != null) e.reverses = String(r.reverses_id);
    entries.set(e.id, e);
  }
  for (const r of db.all('SELECT journal_entry_id, account_code, customer_id, debit, credit FROM journal_line ORDER BY rowid')) {
    const e = entries.get(String(r.journal_entry_id));
    if (!e) continue;
    const debit = Number(r.debit);
    const line = {
      account: String(r.account_code) as AccountCode,
      side: debit > 0 ? ('debit' as const) : ('credit' as const),
      amount: debit > 0 ? debit : Number(r.credit),
    };
    (e.lines as unknown[]).push(r.customer_id == null ? line : { ...line, customerId: String(r.customer_id) });
  }
  return [...entries.values()];
}

/**
 * Posts one entry and returns its id. Throws LedgerError, saving nothing, if the core refuses it.
 * Call it inside the transaction that saves the Document or record the entry comes from.
 */
export function postEntry(db: Db, input: Omit<EntryInput, 'id'> & { reason?: string }): string {
  return db.transaction(() => {
    const id = db.insert('journal_entry', {
      accounting_date: input.accountingDate,
      recorded_at: input.recordedAt,
      time_zone: TIME_ZONE,
      source_kind: input.source.kind,
      source_id: input.source.id,
      reason: input.reason ?? '',
    });
    // The core refuses an entry that does not balance or takes a balance below nothing.
    post(readJournal(db).filter((e) => e.id !== id), { ...input, id });
    for (const l of input.lines) {
      db.insert('journal_line', {
        journal_entry_id: id,
        account_code: l.account,
        customer_id: l.customerId ?? null,
        debit: l.side === 'debit' ? l.amount : 0,
        credit: l.side === 'credit' ? l.amount : 0,
      });
    }
    return id;
  });
}

/**
 * Puts an entry right by posting its exact reverse, dated the day of the
 * correction, with the reason. The original stays. Throws LedgerError, saving
 * nothing, if the core refuses it (already reversed, or its money is used).
 * Call it inside the transaction of the correction. Returns the new entry's id.
 */
export function reverseEntry(
  db: Db,
  entryId: string,
  correction: { accountingDate: string; recordedAt: string; reason: string },
): string {
  return db.transaction(() => {
    const before = readJournal(db);
    const original = before.find((e) => e.id === entryId);
    if (!original) throw new Error(`No journal entry ${entryId}`);
    // The core refuses a second reverse, or one that takes a balance below nothing.
    const lines = reverse(before, entryId, { id: 'correction', ...correction }).at(-1)!.lines;
    const id = db.insert('journal_entry', {
      accounting_date: correction.accountingDate,
      recorded_at: correction.recordedAt,
      time_zone: TIME_ZONE,
      source_kind: original.source.kind,
      source_id: original.source.id,
      reason: correction.reason,
      reverses_id: entryId,
    });
    for (const l of lines) {
      db.insert('journal_line', {
        journal_entry_id: id,
        account_code: l.account,
        customer_id: l.customerId ?? null,
        debit: l.side === 'debit' ? l.amount : 0,
        credit: l.side === 'credit' ? l.amount : 0,
      });
    }
    return id;
  });
}

function balance(db: Db, account: AccountCode, customerId?: string): Cents {
  const r = db.get(
    `SELECT coalesce(sum(debit), 0) AS d, coalesce(sum(credit), 0) AS c FROM journal_line
     WHERE account_code = ? ${customerId === undefined ? '' : 'AND customer_id = ?'}`,
    customerId === undefined ? [account] : [account, customerId],
  );
  return Number(r?.d) - Number(r?.c);
}

/** What one Customer owes, from the ledger. */
export const customerOwes = (db: Db, customerId: string): Cents => balance(db, ACCOUNT.customersOwe, customerId);

/** What all Customers owe together: the "Customers owe you" figure. */
export const totalOwed = (db: Db): Cents => balance(db, ACCOUNT.customersOwe);

/** The recorded time of the latest entry, UTC, or null before the first. */
export function lastRecordedAt(db: Db): string | null {
  const r = db.get('SELECT max(recorded_at) AS t FROM journal_entry');
  return r?.t == null ? null : String(r.t);
}
