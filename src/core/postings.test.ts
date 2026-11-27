import { describe, expect, it } from "vitest";
import { ACCOUNT } from "./accounts";
import { customerBalances } from "./checks";
import { accountBalance, emptyJournal, post, type EntryLine, type Journal } from "./ledger";
import { postings } from "./postings";

let n = 0;
function postLines(journal: Journal, lines: EntryLine[]): Journal {
  n += 1;
  return post(journal, {
    id: `e${n}`,
    accountingDate: "2026-11-27",
    recordedAt: "2026-11-27T09:00:00Z",
    source: { kind: "test", id: `s${n}` },
    lines,
  });
}

const c = "c1";

describe("postings for each money event", () => {
  it("Invoice issued: debit Customers owe, credit Sales, after Discount", () => {
    const j = postLines(emptyJournal, postings.invoiceIssued({ customerId: c, total: 23220 }));
    expect(customerBalances(j, c).owes).toBe(23220);
    expect(accountBalance(j, ACCOUNT.sales)).toBe(23220);
  });

  it("Payment: debit the method's money account, credit Customers owe, Deposits held and Credit held", () => {
    let j = postLines(emptyJournal, postings.invoiceIssued({ customerId: c, total: 10000 }));
    j = postLines(
      j,
      postings.payment({ customerId: c, method: "card", toInvoices: 10000, toDeposits: 2000, toCredit: 300 }),
    );
    expect(accountBalance(j, ACCOUNT.bank)).toBe(12300);
    expect(customerBalances(j, c)).toEqual({ owes: 0, depositsHeld: 2000, creditHeld: 300 });
  });

  it("Payment leaves out empty parts and refuses one with no money", () => {
    expect(postings.payment({ customerId: c, method: "cash", toCredit: 500 })).toEqual([
      { account: ACCOUNT.cash, side: "debit", amount: 500 },
      { account: ACCOUNT.creditHeld, side: "credit", amount: 500, customerId: c },
    ]);
    expect(() => postings.payment({ customerId: c, method: "cash" })).toThrow();
  });

  it("Deposit or Credit applied: debit what is held, credit Customers owe; no money moves", () => {
    let j = postLines(emptyJournal, postings.invoiceIssued({ customerId: c, total: 10000 }));
    j = postLines(j, postings.payment({ customerId: c, method: "ecocash", toDeposits: 6000, toCredit: 1000 }));
    j = postLines(j, postings.applied({ customerId: c, from: "deposit", amount: 6000 }));
    j = postLines(j, postings.applied({ customerId: c, from: "credit", amount: 1000 }));
    expect(customerBalances(j, c)).toEqual({ owes: 3000, depositsHeld: 0, creditHeld: 0 });
    expect(accountBalance(j, ACCOUNT.ecoCash)).toBe(7000);
  });

  it("Deposit moved to Credit: debit Deposits held, credit Credit held", () => {
    let j = postLines(emptyJournal, postings.payment({ customerId: c, method: "cash", toDeposits: 5000 }));
    j = postLines(j, postings.depositToCredit({ customerId: c, amount: 5000 }));
    expect(customerBalances(j, c)).toEqual({ owes: 0, depositsHeld: 0, creditHeld: 5000 });
  });

  it("Refund: debit what is held, credit the money account", () => {
    let j = postLines(emptyJournal, postings.payment({ customerId: c, method: "innbucks", toCredit: 5000 }));
    j = postLines(j, postings.refund({ customerId: c, from: "credit", method: "cash", amount: 2000 }));
    expect(customerBalances(j, c).creditHeld).toBe(3000);
    expect(accountBalance(j, ACCOUNT.innBucks)).toBe(5000);
    expect(accountBalance(j, ACCOUNT.cash)).toBe(-2000);
  });

  it("Write-off: debit Bad debts, credit Customers owe", () => {
    let j = postLines(emptyJournal, postings.invoiceIssued({ customerId: c, total: 10000 }));
    j = postLines(j, postings.writeOff({ customerId: c, amount: 2500 }));
    expect(customerBalances(j, c).owes).toBe(7500);
    expect(accountBalance(j, ACCOUNT.badDebts)).toBe(2500);
  });

  it("Opening balances: owed debits Customers owe, Credit held credits Credit held, both against Opening balances", () => {
    let j = postLines(emptyJournal, postings.openingOwed({ customerId: c, amount: 45000 }));
    j = postLines(j, postings.openingCredit({ customerId: c, amount: 1000 }));
    expect(customerBalances(j, c)).toEqual({ owes: 45000, depositsHeld: 0, creditHeld: 1000 });
    expect(accountBalance(j, ACCOUNT.openingBalances)).toBe(44000);
    expect(accountBalance(j, ACCOUNT.sales)).toBe(0);
  });
});
