import { documentTotals, MoneyError, type Discount, type Line, type Totals } from "./money";

/**
 * The figures a Quotation or Invoice is issued with. Refused (MoneyError) with no lines, a
 * Discount above the Subtotal, or a Total that is not above zero.
 */
export function issuableTotals(input: { lines: readonly Line[]; discount?: Discount }): Totals {
  if (input.lines.length === 0) throw new MoneyError("Add at least one line.");
  const totals = documentTotals(input);
  if (totals.total <= 0) throw new MoneyError("The Total must be above zero. Add a price to a line.");
  return totals;
}
