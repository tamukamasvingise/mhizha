import { describe, expect, it } from "vitest";
import { issuableTotals } from "./issue";
import { MoneyError } from "./money";

describe("the figures an Invoice is issued with", () => {
  it("are the lines' Subtotal less the Discount", () => {
    const lines = [
      { quantity: 2_000, unitPrice: 4_500 },
      { quantity: 12_500, unitPrice: 199 },
    ];
    expect(issuableTotals({ lines, discount: { kind: "percent", tenths: 100 } })).toMatchObject({
      subtotal: 11_488,
      discount: 1_149,
      total: 10_339,
    });
  });

  it("refuse no lines, and a Total of zero", () => {
    expect(() => issuableTotals({ lines: [] })).toThrow(new MoneyError("Add at least one line."));
    expect(() => issuableTotals({ lines: [{ quantity: 1_000, unitPrice: 0 }] })).toThrow(
      new MoneyError("The Total must be above zero. Add a price to a line."),
    );
    expect(() =>
      issuableTotals({ lines: [{ quantity: 1_000, unitPrice: 500 }], discount: { kind: "amount", cents: 500 } }),
    ).toThrow(MoneyError);
  });
});
