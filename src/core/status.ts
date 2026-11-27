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

/** An Issued Quotation's status. Always worked out from the facts, never stored. */
export type QuotationStatus = "issued" | "accepted" | "declined" | "expired" | "superseded" | "cancelled";

/**
 * Cancelled, then Superseded (a later Revision is Issued), then the User's answer
 * (Accepted or Declined); with no answer, Expired after the valid-until date, else Issued.
 * Expired locks nothing. Dates are YYYY-MM-DD.
 */
export function quotationStatus(
  q: { answer: "accepted" | "declined" | null; cancelled: boolean; superseded: boolean; validUntil: string },
  today: string,
): QuotationStatus {
  if (q.cancelled) return "cancelled";
  if (q.superseded) return "superseded";
  if (q.answer) return q.answer;
  return today > q.validUntil ? "expired" : "issued";
}
