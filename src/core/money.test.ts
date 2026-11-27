import { describe, expect, it } from "vitest";
import { discountLabel, discountShare, documentTotals, lineAmount, MoneyError } from "./money";

describe("line amount", () => {
  it("is quantity times unit price in whole cents", () => {
    // 2.000 x US$12.50 = US$25.00
    expect(lineAmount(2000, 1250)).toBe(2500);
  });

  it("rounds half a cent up and less than half down", () => {
    // 0.500 x US$0.01 = half a cent
    expect(lineAmount(500, 1)).toBe(1);
    // 1.333 x US$1.00 = US$1.333
    expect(lineAmount(1333, 100)).toBe(133);
    // 2.5 x US$0.03 = 7.5 cents
    expect(lineAmount(2500, 3)).toBe(8);
  });

  it("allows a zero price and refuses negatives or fractions", () => {
    expect(lineAmount(3000, 0)).toBe(0);
    expect(() => lineAmount(1000, -1)).toThrow();
    expect(() => lineAmount(-1000, 100)).toThrow();
    expect(() => lineAmount(1000, 10.5)).toThrow();
  });
});

describe("document totals", () => {
  it("adds lines exactly to the Subtotal and leaves VAT blank", () => {
    const t = documentTotals({
      lines: [
        { quantity: 1333, unitPrice: 100 }, // 1.33
        { quantity: 1333, unitPrice: 100 }, // 1.33
        { quantity: 1000, unitPrice: 4500 }, // 45.00
      ],
    });
    expect(t.lineAmounts).toEqual([133, 133, 4500]);
    expect(t.subtotal).toBe(4766);
    expect(t.discount).toBe(0);
    expect(t.vat).toBeNull();
    expect(t.total).toBe(4766);
  });
});

describe("Discount", () => {
  const lines = [{ quantity: 1000, unitPrice: 25800 }]; // US$258.00

  it("as an amount comes off the Subtotal: Subtotal - Discount + VAT = Total", () => {
    const t = documentTotals({ lines, discount: { kind: "amount", cents: 800 } });
    expect(t.subtotal).toBe(25800);
    expect(t.discount).toBe(800);
    expect(t.total).toBe(25000);
  });

  it("as a percentage rounds to the cent: 10% of US$258.00 = US$25.80", () => {
    const t = documentTotals({ lines, discount: { kind: "percent", tenths: 100 } });
    expect(t.discount).toBe(2580);
    expect(t.total).toBe(23220);
    // 12.5% of US$0.20 = 2.5 cents, half up
    expect(
      documentTotals({
        lines: [{ quantity: 1000, unitPrice: 20 }],
        discount: { kind: "percent", tenths: 125 },
      }).discount,
    ).toBe(3);
  });

  it("refuses a percentage outside 0 to 99.9", () => {
    expect(() => documentTotals({ lines, discount: { kind: "percent", tenths: 1000 } })).toThrow(
      "Enter a percentage from 0 to 99.9.",
    );
    expect(() => documentTotals({ lines, discount: { kind: "percent", tenths: -1 } })).toThrow(
      "Enter a percentage from 0 to 99.9.",
    );
    expect(documentTotals({ lines, discount: { kind: "percent", tenths: 999 } }).discount).toBe(
      25774,
    );
  });

  it("is never above the Subtotal", () => {
    expect(() => documentTotals({ lines, discount: { kind: "amount", cents: 25801 } })).toThrow(
      MoneyError,
    );
    expect(documentTotals({ lines, discount: { kind: "amount", cents: 25800 } }).total).toBe(0);
  });

  it("prints as Discount (10%) or plain Discount", () => {
    expect(discountLabel({ kind: "percent", tenths: 100 })).toBe("Discount (10%)");
    expect(discountLabel({ kind: "percent", tenths: 125 })).toBe("Discount (12.5%)");
    expect(discountLabel({ kind: "amount", cents: 500 })).toBe("Discount");
  });
});

describe("Discount shared across several Invoices from one Quotation", () => {
  // Quotation Subtotal US$300.00 with a US$10.00 Discount, invoiced in three thirds
  const q = { discount: 1000, quotationSubtotal: 30000 };

  it("each takes Discount x Invoice Subtotal / Quotation Subtotal, and the last the leftover cents", () => {
    const first = discountShare({ ...q, invoiceSubtotal: 10000, alreadyTaken: 0, last: false });
    const second = discountShare({ ...q, invoiceSubtotal: 10000, alreadyTaken: first, last: false });
    const third = discountShare({
      ...q,
      invoiceSubtotal: 10000,
      alreadyTaken: first + second,
      last: true,
    });
    expect([first, second, third]).toEqual([333, 333, 334]);
  });

  it("never adds up to more than the Discount, even when invoicing goes over", () => {
    const first = discountShare({ ...q, invoiceSubtotal: 20000, alreadyTaken: 0, last: false });
    const second = discountShare({ ...q, invoiceSubtotal: 20000, alreadyTaken: first, last: false });
    expect(first).toBe(667);
    expect(second).toBe(333);
  });

  it("is never above the Invoice's own Subtotal", () => {
    expect(discountShare({ ...q, invoiceSubtotal: 200, alreadyTaken: 0, last: true })).toBe(200);
  });
});
