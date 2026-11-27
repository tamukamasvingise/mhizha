import { describe, expect, it } from "vitest";
import { ACCOUNT } from "./accounts";
import { accountBalance, emptyJournal, LedgerError, post, type EntryInput } from "./ledger";

const when = { accountingDate: "2026-11-27", recordedAt: "2026-11-27T09:00:00.000+02:00" };

function invoice(id: string, customerId: string, cents: number): EntryInput {
  return {
    id,
    ...when,
    source: { kind: "invoice", id: `inv-${id}` },
    lines: [
      { account: ACCOUNT.customersOwe, side: "debit", amount: cents, customerId },
      { account: ACCOUNT.sales, side: "credit", amount: cents },
    ],
  };
}

describe("ledger", () => {
  it("posts a balanced entry and moves the account balances", () => {
    const journal = post(emptyJournal, invoice("e1", "c1", 15025));
    expect(journal).toHaveLength(1);
    expect(accountBalance(journal, ACCOUNT.customersOwe)).toBe(15025);
    expect(accountBalance(journal, ACCOUNT.sales)).toBe(15025);
    expect(accountBalance(journal, ACCOUNT.customersOwe, { customerId: "c1" })).toBe(15025);
    expect(accountBalance(journal, ACCOUNT.customersOwe, { customerId: "c2" })).toBe(0);
  });

  it("refuses an unbalanced entry and posts nothing", () => {
    const bad = invoice("e1", "c1", 100);
    const lines = [bad.lines[0]!, { ...bad.lines[1]!, amount: 99 }];
    expect(() => post(emptyJournal, { ...bad, lines })).toThrow(LedgerError);
  });

  it.each([
    ["a zero amount", 0],
    ["a negative amount", -100],
    ["a fraction of a cent", 10.5],
  ])("refuses %s", (_, amount) => {
    expect(() => post(emptyJournal, invoice("e1", "c1", amount))).toThrow(LedgerError);
  });

  it("refuses an entry with fewer than two lines", () => {
    expect(() => post(emptyJournal, { ...invoice("e1", "c1", 100), lines: [] })).toThrow(LedgerError);
  });

  it("refuses a reused entry id", () => {
    const journal = post(emptyJournal, invoice("e1", "c1", 100));
    expect(() => post(journal, invoice("e1", "c1", 100))).toThrow(LedgerError);
  });

  it("refuses bad dates", () => {
    expect(() => post(emptyJournal, { ...invoice("e1", "c1", 100), accountingDate: "27/11/2026" })).toThrow(LedgerError);
    expect(() => post(emptyJournal, { ...invoice("e1", "c1", 100), accountingDate: "2026-02-30" })).toThrow(LedgerError);
    expect(() => post(emptyJournal, { ...invoice("e1", "c1", 100), recordedAt: "yesterday" })).toThrow(LedgerError);
  });

  it("needs a Customer on Customer accounts and refuses one elsewhere", () => {
    const e = invoice("e1", "c1", 100);
    const noCustomer = [{ ...e.lines[0]!, customerId: undefined }, e.lines[1]!];
    expect(() => post(emptyJournal, { ...e, lines: noCustomer })).toThrow(LedgerError);
    const stray = [e.lines[0]!, { ...e.lines[1]!, customerId: "c1" }];
    expect(() => post(emptyJournal, { ...e, lines: stray })).toThrow(LedgerError);
  });

  it("refuses an unknown account", () => {
    const e = invoice("e1", "c1", 100);
    const lines = [e.lines[0]!, { ...e.lines[1]!, account: "9999" as never }];
    expect(() => post(emptyJournal, { ...e, lines })).toThrow(LedgerError);
  });

  it("refuses to take a Customer below nothing: nothing applied beyond a balance", () => {
    const journal = post(emptyJournal, invoice("e1", "c1", 100));
    const overpaid: EntryInput = {
      id: "e2",
      ...when,
      source: { kind: "payment", id: "p1" },
      lines: [
        { account: ACCOUNT.cash, side: "debit", amount: 101 },
        { account: ACCOUNT.customersOwe, side: "credit", amount: 101, customerId: "c1" },
      ],
    };
    expect(() => post(journal, overpaid)).toThrow(LedgerError);
    const fromEmptyCredit: EntryInput = {
      id: "e3",
      ...when,
      source: { kind: "applied", id: "a1" },
      lines: [
        { account: ACCOUNT.creditHeld, side: "debit", amount: 50, customerId: "c1" },
        { account: ACCOUNT.customersOwe, side: "credit", amount: 50, customerId: "c1" },
      ],
    };
    expect(() => post(journal, fromEmptyCredit)).toThrow(LedgerError);
  });
});
