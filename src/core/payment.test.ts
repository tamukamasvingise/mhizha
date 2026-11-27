import { describe, expect, it } from "vitest";
import { dateReceivedProblem, fillOldestFirst } from "./payment";

// Invoices are given oldest first, each with what it still owes.
const owing = [
  { id: "inv1", owed: 10_000 },
  { id: "inv2", owed: 5_000 },
  { id: "inv3", owed: 2_500 },
];

describe("filling ticked Invoices oldest first", () => {
  it("pays the oldest in full before the next, and part-pays the last it reaches", () => {
    expect(fillOldestFirst(12_000, owing)).toEqual({
      parts: [
        { id: "inv1", amount: 10_000 },
        { id: "inv2", amount: 2_000 },
      ],
      applied: 12_000,
      left: 0,
    });
  });

  it("leaves over what is more than the ticked Invoices owe", () => {
    expect(fillOldestFirst(20_000, owing)).toMatchObject({ applied: 17_500, left: 2_500 });
  });

  it("takes a changed amount for an Invoice and fills the rest around it", () => {
    expect(fillOldestFirst(12_000, owing, { inv1: 4_000 }).parts).toEqual([
      { id: "inv1", amount: 4_000 },
      { id: "inv2", amount: 5_000 },
      { id: "inv3", amount: 2_500 },
    ]);
  });

  it("never puts more on an Invoice than it owes or than is left of the Payment", () => {
    expect(fillOldestFirst(6_000, owing, { inv2: 9_000, inv1: 1_000 }).parts).toEqual([
      { id: "inv1", amount: 1_000 },
      { id: "inv2", amount: 5_000 },
    ]);
  });

  it("puts nothing on an Invoice changed to zero", () => {
    expect(fillOldestFirst(3_000, owing, { inv1: 0 }).parts).toEqual([{ id: "inv2", amount: 3_000 }]);
  });
});

describe("the Date received", () => {
  const today = "2026-11-27";
  it("may be today or earlier", () => {
    expect(dateReceivedProblem("2026-11-27", today)).toBeNull();
    expect(dateReceivedProblem("2026-11-02", today)).toBeNull();
  });
  it("is never in the future", () => {
    expect(dateReceivedProblem("2026-11-28", today)).toEqual({
      kind: "error",
      message: "The date received can't be after today.",
    });
  });
  it("warns, but allows, a day in an earlier year", () => {
    expect(dateReceivedProblem("2025-12-31", today)).toEqual({
      kind: "warning",
      message: "This Payment is dated in 2025, an earlier year. Check the date; it is saved in 2025's records.",
    });
  });
  it("must be a real day", () => {
    expect(dateReceivedProblem("2026-02-30", today)?.kind).toBe("error");
  });
});
