import { describe, expect, it } from "vitest";
import { invoiceStatus } from "./status";

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
