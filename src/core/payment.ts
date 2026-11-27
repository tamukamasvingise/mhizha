import { isAccountingDate } from "./ledger";
import type { Cents } from "./money";

/** What one ticked Invoice (or Opening balance item) still owes. */
export interface Owing {
  id: string;
  owed: Cents;
}

export interface PaymentSplit {
  /** What goes on each Invoice, oldest first; Invoices that get nothing are left out. */
  parts: { id: string; amount: Cents }[];
  applied: Cents;
  /** What is more than the ticked Invoices take. */
  left: Cents;
}

/**
 * Spreads a Payment over the ticked Invoices, given oldest first: each takes what it owes,
 * or what is left. An amount the User changed is kept, but never above what the Invoice
 * owes or what is left of the Payment.
 */
export function fillOldestFirst(
  amount: Cents,
  ticked: readonly Owing[],
  changed: Readonly<Record<string, Cents>> = {},
): PaymentSplit {
  let left = Math.max(0, amount);
  const parts: PaymentSplit["parts"] = [];
  for (const o of ticked) {
    const wanted = changed[o.id] ?? o.owed;
    const take = Math.max(0, Math.min(wanted, o.owed, left));
    if (take > 0) parts.push({ id: o.id, amount: take });
    left -= take;
  }
  return { parts, applied: Math.max(0, amount) - left, left };
}

/**
 * What is wrong with a Date received, or null. Never after today; a day in an earlier year
 * is allowed with a warning (version 1 closes no period). Dates are YYYY-MM-DD.
 */
export function dateReceivedProblem(
  date: string,
  today: string,
): { kind: "error" | "warning"; message: string } | null {
  if (!isAccountingDate(date)) return { kind: "error", message: "Pick the day the money was received." };
  if (date > today) return { kind: "error", message: "The date received can't be after today." };
  const year = date.slice(0, 4);
  if (year < today.slice(0, 4)) {
    return {
      kind: "warning",
      message: `This Payment is dated in ${year}, an earlier year. Check the date; it is saved in ${year}'s records.`,
    };
  }
  return null;
}
