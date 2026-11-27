import { describe, expect, it } from "vitest";
import { invoiceStatus, quotationStatus } from "./status";

const inv = { total: 10_000, applied: 0, writtenOff: 0, dueDate: "2026-11-30" };

describe("an Invoice's status, worked out", () => {
  it("is Unpaid with nothing paid, up to and on its due date", () => {
    expect(invoiceStatus(inv, "2026-11-27")).toBe("unpaid");
    expect(invoiceStatus(inv, "2026-11-30")).toBe("unpaid");
  });

  it("is Overdue the day after the due date with money owing", () => {
    expect(invoiceStatus(inv, "2026-12-01")).toBe("overdue");
    expect(invoiceStatus({ ...inv, applied: 4_000 }, "2026-12-01")).toBe("overdue");
  });

  it("is Part-paid with some money applied, Paid with all of it", () => {
    expect(invoiceStatus({ ...inv, applied: 4_000 }, "2026-11-27")).toBe("part-paid");
    expect(invoiceStatus({ ...inv, applied: 10_000 }, "2026-12-25")).toBe("paid");
  });

  it("is Closed when a Write-off covers the rest", () => {
    expect(invoiceStatus({ ...inv, applied: 4_000, writtenOff: 6_000 }, "2026-12-25")).toBe("closed");
  });
});

describe("a Quotation's status, worked out", () => {
  const q = { answer: null, cancelled: false, superseded: false, validUntil: "2026-12-27" } as const;

  it("is Issued until valid-until, Expired the day after, with no answer", () => {
    expect(quotationStatus(q, "2026-12-27")).toBe("issued");
    expect(quotationStatus(q, "2026-12-28")).toBe("expired");
  });

  it("stays Accepted or Declined after valid-until", () => {
    expect(quotationStatus({ ...q, answer: "accepted" }, "2027-02-01")).toBe("accepted");
    expect(quotationStatus({ ...q, answer: "declined" }, "2026-11-30")).toBe("declined");
  });

  it("is Superseded once a later Revision is issued, even if it was Accepted", () => {
    expect(quotationStatus({ ...q, answer: "accepted", superseded: true }, "2026-11-30")).toBe("superseded");
  });

  it("is Cancelled above everything else", () => {
    expect(quotationStatus({ ...q, answer: "accepted", cancelled: true }, "2026-11-30")).toBe("cancelled");
  });
});
