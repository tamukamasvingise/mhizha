import { ACCOUNT, moneyAccountFor, type AccountCode, type PaymentMethod } from "./accounts";
import type { EntryLine } from "./ledger";
import { MoneyError, type Cents } from "./money";

/**
 * The lines each money event posts (spec section 9). Pass them to `post` with the entry's id,
 * dates and source. Cancellations and undos are `reverse`, never a posting of their own.
 */

type Held = "deposit" | "credit";
const HELD: Record<Held, AccountCode> = { deposit: ACCOUNT.depositsHeld, credit: ACCOUNT.creditHeld };

const debit = (account: AccountCode, amount: Cents, customerId?: string): EntryLine =>
  customerId === undefined ? { account, side: "debit", amount } : { account, side: "debit", amount, customerId };
const credit = (account: AccountCode, amount: Cents, customerId?: string): EntryLine =>
  customerId === undefined ? { account, side: "credit", amount } : { account, side: "credit", amount, customerId };

export const postings = {
  /** Invoice issued, after Discount: debit Customers owe, credit Sales. */
  invoiceIssued({ customerId, total }: { customerId: string; total: Cents }): EntryLine[] {
    return [debit(ACCOUNT.customersOwe, total, customerId), credit(ACCOUNT.sales, total)];
  },

  /** Payment: debit the money account; credit Customers owe, Deposits held and Credit held. */
  payment(p: {
    customerId: string;
    method: PaymentMethod;
    toInvoices?: Cents;
    toDeposits?: Cents;
    toCredit?: Cents;
  }): EntryLine[] {
    const parts: [AccountCode, Cents][] = [
      [ACCOUNT.customersOwe, p.toInvoices ?? 0],
      [ACCOUNT.depositsHeld, p.toDeposits ?? 0],
      [ACCOUNT.creditHeld, p.toCredit ?? 0],
    ];
    const total = parts.reduce((sum, [, amount]) => sum + amount, 0);
    if (total <= 0) throw new MoneyError("A Payment must be more than zero.");
    return [
      debit(moneyAccountFor(p.method), total),
      ...parts.filter(([, amount]) => amount !== 0).map(([account, amount]) => credit(account, amount, p.customerId)),
    ];
  },

  /** Deposit or Credit applied to an Invoice: debit what is held, credit Customers owe. */
  applied({ customerId, from, amount }: { customerId: string; from: Held; amount: Cents }): EntryLine[] {
    return [debit(HELD[from], amount, customerId), credit(ACCOUNT.customersOwe, amount, customerId)];
  },

  /** Deposit moved to Credit: debit Deposits held, credit Credit held. */
  depositToCredit({ customerId, amount }: { customerId: string; amount: Cents }): EntryLine[] {
    return [debit(ACCOUNT.depositsHeld, amount, customerId), credit(ACCOUNT.creditHeld, amount, customerId)];
  },

  /** Credit made a Quotation's Deposit (an opening Credit on a re-created Quotation): debit Credit held, credit Deposits held. */
  creditToDeposit({ customerId, amount }: { customerId: string; amount: Cents }): EntryLine[] {
    return [debit(ACCOUNT.creditHeld, amount, customerId), credit(ACCOUNT.depositsHeld, amount, customerId)];
  },

  /** Refund: debit what is held, credit the money account it was paid from. */
  refund(r: { customerId: string; from: Held; method: PaymentMethod; amount: Cents }): EntryLine[] {
    return [debit(HELD[r.from], r.amount, r.customerId), credit(moneyAccountFor(r.method), r.amount)];
  },

  /** Write-off: debit Bad debts, credit Customers owe. */
  writeOff({ customerId, amount }: { customerId: string; amount: Cents }): EntryLine[] {
    return [debit(ACCOUNT.badDebts, amount), credit(ACCOUNT.customersOwe, amount, customerId)];
  },

  /** Opening balance owed: debit Customers owe, credit Opening balances. */
  openingOwed({ customerId, amount }: { customerId: string; amount: Cents }): EntryLine[] {
    return [debit(ACCOUNT.customersOwe, amount, customerId), credit(ACCOUNT.openingBalances, amount)];
  },

  /** Opening balance of Credit held: debit Opening balances, credit Credit held. */
  openingCredit({ customerId, amount }: { customerId: string; amount: Cents }): EntryLine[] {
    return [debit(ACCOUNT.openingBalances, amount), credit(ACCOUNT.creditHeld, amount, customerId)];
  },
};
