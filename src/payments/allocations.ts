// What money has been applied to an Invoice: the allocations to it, less any
// that were reversed. Kept apart so Documents can read it without the rest of Payments.
import type { Cents } from '../core';
import type { Db } from '../db';

/** Money applied to one Invoice, from Payments (and later Deposits and Credit). */
export function appliedTo(db: Db, invoiceId: string): Cents {
  const r = db.get(
    `SELECT coalesce(sum(a.amount), 0) AS n FROM allocation a
     WHERE a.to_id = ? AND a.reverses_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM allocation r WHERE r.reverses_id = a.id)`,
    [invoiceId],
  );
  return Number(r?.n ?? 0);
}
