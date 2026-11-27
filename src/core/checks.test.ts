import { describe, expect, it } from "vitest";
import { ACCOUNT } from "./accounts";
import { checkLedger, customerBalances } from "./checks";
import { emptyJournal, post, type Entry, type Journal } from "./ledger";

const when = { accountingDate: "2026-11-27", recordedAt: "2026-11-27T09:00:00Z" };

const journal: Journal = post(
  post(emptyJournal, {
    id: "e1",
    ...when,
    source: { kind: "invoice", id: "i1" },
    lines: [
      { account: ACCOUNT.customersOwe, side: "debit", amount: 10000, customerId: "c1" },
      { account: ACCOUNT.sales, side: "credit", amount: 10000 },
    ],
  }),
  {
    id: "e2",
    ...when,
    source: { kind: "payment", id: "p1" },
    lines: [
      { account: ACCOUNT.cash, side: "debit", amount: 6000 },
      { account: ACCOUNT.customersOwe, side: "credit", amount: 4000, customerId: "c1" },
      { account: ACCOUNT.depositsHeld, side: "credit", amount: 1500, customerId: "c1" },
      { account: ACCOUNT.creditHeld, side: "credit", amount: 500, customerId: "c1" },
    ],
  },
);

describe("Customer balances from the ledger", () => {
  it("reads what a Customer owes and what is held for them, kept apart", () => {
    expect(customerBalances(journal, "c1")).toEqual({ owes: 6000, depositsHeld: 1500, creditHeld: 500 });
    expect(customerBalances(journal, "c2")).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 0 });
  });
});

describe("ledger checks", () => {
  it("pass when debits equal credits and the ledger agrees with the Customer balances", () => {
    const expected = new Map([["c1", { owes: 6000, depositsHeld: 1500, creditHeld: 500 }]]);
    expect(checkLedger(journal, expected)).toEqual([]);
  });

  it("find a Customer whose worked-out balances disagree with the ledger", () => {
    const expected = new Map([
      ["c1", { owes: 5000, depositsHeld: 1500, creditHeld: 500 }],
      ["c2", { owes: 100, depositsHeld: 0, creditHeld: 0 }],
    ]);
    const problems = checkLedger(journal, expected);
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toMatch(/c1/);
    expect(problems.join("\n")).toMatch(/c2/);
  });

  it("find a Customer in the ledger that the worked-out balances leave out", () => {
    expect(checkLedger(journal, new Map())).toHaveLength(1);
  });

  it("find debits that don't equal credits, and Customer lines without a Customer, in records read back from a Backup", () => {
    const broken: Entry[] = [
      {
        id: "x1",
        ...when,
        source: { kind: "invoice", id: "i9" },
        lines: [
          { account: ACCOUNT.customersOwe, side: "debit", amount: 100 },
          { account: ACCOUNT.sales, side: "credit", amount: 90 },
        ],
      },
    ];
    const problems = checkLedger(broken);
    expect(problems.some((p) => /x1/.test(p) && /debits/i.test(p))).toBe(true);
    expect(problems.some((p) => /Customers owe/.test(p))).toBe(true);
  });

  it("change nothing", () => {
    const before = JSON.stringify(journal);
    checkLedger(journal, new Map());
    expect(JSON.stringify(journal)).toBe(before);
  });
});
