// Issuing a Receipt Document (type REC) or a Refund (type REF): the next
// number, the frozen copy of what it prints, and the Document itself. Shared
// by money Receipts (a Payment), "Deposit applied" and "Credit applied"
// Receipts (no new money) and Refunds. Call inside the save that makes what
// the Document records.
import { sumInWords, type Cents } from '../core';
import type { Db } from '../db';
import type { FrozenCopy } from '../documents';
import { people } from '../people';
import { TIME_ZONE, todayAt } from '../setup/dates';
import { businessDetails, documentCounters, formatNumber } from '../setup/store';

const NO_SITE: FrozenCopy['site'] = {
  name: '',
  address: { lines: '', suburb: '', city: '', province: '', country: '' },
  contactName: '',
  contactPhone: '',
};

/** "INV-0001", "INV-0001 and INV-0002", "INV-0001, INV-0002 and INV-0003". */
export function listed(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

type MoneyType = 'REC' | 'REF';

/** A sequence (REC or REF), and the number the next Document of it gets. */
export function counterOf(db: Db, type: MoneyType) {
  const c = documentCounters(db).find((x) => x.type === type)!;
  return { ...c, next: c.lastNumber == null ? c.startingNumber : c.lastNumber + 1 };
}

/** The REC sequence, and the number the next Receipt gets. */
export const receiptCounter = (db: Db) => counterOf(db, 'REC');

type Issue = { customerId: string; jobIds: readonly string[]; jobTitles: readonly string[]; amount: Cents; at: number };

/** Issues a Receipt Document of `amount` for the Customer, at `at`. Returns its id and number. */
export const issueReceipt = (db: Db, r: Issue) => issueMoneyDocument(db, 'REC', r);

/** Issues a Receipt or a Refund Document of `amount` for the Customer, at `at`. Returns its id and number. */
export function issueMoneyDocument(db: Db, type: MoneyType, r: Issue): { id: string; number: string } {
  const issuedAt = new Date(r.at).toISOString();
  const issueDate = todayAt(r.at);
  const c = counterOf(db, type);
  const number = formatNumber(c.prefix, c.next);
  db.update('document_counter', String(db.get('SELECT id FROM document_counter WHERE type = ?', [type])!.id), { last_number: c.next });
  const cust = people(db, () => issueDate).customer(r.customerId);
  const jobs = [...new Set(r.jobIds)];
  const frozen: FrozenCopy = {
    business: (businessDetails(db, issueDate) ?? businessDetails(db))!,
    customer: {
      kind: cust.kind, name: cust.name, phones: cust.phones, whatsapp: cust.whatsapp, email: cust.email, address: cust.address, taxNumber: cust.taxNumber,
    },
    site: NO_SITE,
    job: { title: listed([...new Set(r.jobTitles)]) },
  };
  const id = db.insert('document', {
    type,
    customer_id: r.customerId,
    job_id: jobs.length === 1 ? jobs[0]! : null,
    number: c.next,
    printed_number: number,
    issued_at: issuedAt,
    time_zone: TIME_ZONE,
    issue_date: issueDate,
    tax_status: 'not registered',
    subtotal: r.amount,
    discount_cents: 0,
    total: r.amount,
    sum_in_words: sumInWords(r.amount),
    frozen: JSON.stringify(frozen),
  });
  return { id, number };
}
