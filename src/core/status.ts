import type { Cents } from "./money";

/** An Issued Invoice's status. Always worked out, never stored. Cancelled is a fact of its own. */
export type InvoiceStatus = "unpaid" | "part-paid" | "paid" | "overdue" | "closed";

/**
 * Unpaid, Part-paid or Paid by the money applied; Overdue when past the due date with money
 * owing; Closed when a Write-off covers the rest. Dates are YYYY-MM-DD.
 */
export function invoiceStatus(
  invoice: { total: Cents; applied: Cents; writtenOff: Cents; dueDate: string },
  today: string,
): InvoiceStatus {
  const owing = invoice.total - invoice.applied - invoice.writtenOff;
  if (owing <= 0) return invoice.writtenOff > 0 ? "closed" : "paid";
  if (today > invoice.dueDate) return "overdue";
  return invoice.applied > 0 ? "part-paid" : "unpaid";
}
