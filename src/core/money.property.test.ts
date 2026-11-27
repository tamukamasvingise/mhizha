import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { discountShare, documentTotals } from "./money";

const line = fc.record({
  quantity: fc.integer({ min: 0, max: 1_000_000 }),
  unitPrice: fc.integer({ min: 0, max: 10_000_000 }),
});

describe("money properties", () => {
  it("Subtotal - Discount = Total, never below zero, for any lines and percentage", () => {
    fc.assert(
      fc.property(fc.array(line, { maxLength: 30 }), fc.integer({ min: 0, max: 999 }), (lines, tenths) => {
        const t = documentTotals({ lines, discount: { kind: "percent", tenths } });
        expect(t.lineAmounts.reduce((a, b) => a + b, 0)).toBe(t.subtotal);
        expect(t.subtotal - t.discount).toBe(t.total);
        expect(t.total).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(t.discount)).toBe(true);
      }),
    );
  });

  it("shares of a Discount over Invoices that cover the Quotation add up to exactly the Discount", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 1000 }),
        (invoiceSubtotals, perMille) => {
          const quotationSubtotal = invoiceSubtotals.reduce((a, b) => a + b, 0);
          const discount = Math.floor((quotationSubtotal * perMille) / 1000);
          let taken = 0;
          invoiceSubtotals.forEach((invoiceSubtotal, i) => {
            const share = discountShare({
              discount,
              quotationSubtotal,
              invoiceSubtotal,
              alreadyTaken: taken,
              last: i === invoiceSubtotals.length - 1,
            });
            expect(share).toBeGreaterThanOrEqual(0);
            expect(share).toBeLessThanOrEqual(invoiceSubtotal);
            taken += share;
            expect(taken).toBeLessThanOrEqual(discount);
          });
          expect(taken).toBe(discount);
        },
      ),
    );
  });
});
