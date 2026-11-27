import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNTS, LedgerError, postings } from '../core';
import { ACCOUNTS_AT_STEP_6 } from '../db/steps';
import type { Db } from '../db';
import { freshDb } from '../testing';
import { customerOwes, lastRecordedAt, postEntry, readJournal, totalOwed } from '.';

let db: Db;
let a: string;
let b: string;
beforeEach(() => {
  db = freshDb();
  a = db.insert('customer', { kind: 'person', name: 'Tendai Moyo' });
  b = db.insert('customer', { kind: 'person', name: 'Chipo Ndlovu' });
});

const entry = (customerId: string, total: number, at = '2026-11-27T10:00:00.000Z') => ({
  accountingDate: at.slice(0, 10),
  recordedAt: at,
  source: { kind: 'invoice', id: 'doc' },
  lines: postings.invoiceIssued({ customerId, total }),
});

describe('the ledger in the records', () => {
  it('keeps the accounts the core knows, with the same codes', () => {
    expect(ACCOUNTS_AT_STEP_6).toEqual(ACCOUNTS);
    expect(db.all('SELECT code FROM account ORDER BY code').map((r) => r.code)).toEqual(Object.keys(ACCOUNTS).sort());
  });

  it('saves a posted entry and reads it back', () => {
    const id = postEntry(db, entry(a, 12_500));
    const journal = readJournal(db);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ id, accountingDate: '2026-11-27', source: { kind: 'invoice', id: 'doc' } });
    expect(journal[0]!.lines).toEqual(postings.invoiceIssued({ customerId: a, total: 12_500 }));
  });

  it("works out what each Customer owes and what all Customers owe", () => {
    postEntry(db, entry(a, 12_500));
    postEntry(db, entry(a, 500));
    postEntry(db, entry(b, 1_000));
    expect(customerOwes(db, a)).toBe(13_000);
    expect(customerOwes(db, b)).toBe(1_000);
    expect(totalOwed(db)).toBe(14_000);
  });

  it('refuses an unbalanced entry and saves nothing of it', () => {
    const bad = { ...entry(a, 100), lines: [{ account: '1100' as const, side: 'debit' as const, amount: 100, customerId: a }] };
    expect(() => postEntry(db, bad)).toThrow(LedgerError);
    expect(readJournal(db)).toEqual([]);
    expect(db.get('SELECT count(*) AS n FROM journal_line')?.n).toBe(0);
  });

  it('knows the time of the last recorded entry', () => {
    expect(lastRecordedAt(db)).toBeNull();
    postEntry(db, entry(a, 100, '2026-11-27T10:00:00.000Z'));
    postEntry(db, entry(a, 100, '2026-11-26T10:00:00.000Z'));
    expect(lastRecordedAt(db)).toBe('2026-11-27T10:00:00.000Z');
  });

  it('never changes or deletes an entry', () => {
    const id = postEntry(db, entry(a, 100));
    expect(() => db.run('DELETE FROM journal_entry WHERE id = ?', [id])).toThrow();
    expect(() => db.run("UPDATE journal_line SET debit = 5 WHERE journal_entry_id = ? AND debit > 0", [id])).toThrow();
  });
});
