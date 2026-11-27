import { ACCOUNT, ACCOUNTS, type AccountCode } from "./accounts";
import { accountBalance, type Journal } from "./ledger";
import type { Cents } from "./money";

/** What one Customer owes and what the Business holds for them. Never set off against each other. */
export interface CustomerBalances {
  owes: Cents;
  depositsHeld: Cents;
  creditHeld: Cents;
}

const CUSTOMER_ACCOUNTS = {
  owes: ACCOUNT.customersOwe,
  depositsHeld: ACCOUNT.depositsHeld,
  creditHeld: ACCOUNT.creditHeld,
} as const satisfies Record<keyof CustomerBalances, AccountCode>;

/** A Customer's balances read from the ledger. */
export function customerBalances(journal: Journal, customerId: string): CustomerBalances {
  return {
    owes: accountBalance(journal, CUSTOMER_ACCOUNTS.owes, { customerId }),
    depositsHeld: accountBalance(journal, CUSTOMER_ACCOUNTS.depositsHeld, { customerId }),
    creditHeld: accountBalance(journal, CUSTOMER_ACCOUNTS.creditHeld, { customerId }),
  };
}

/**
 * The ledger checks: debits equal credits, every Customer line names its Customer, and, when
 * given the balances worked out from the Documents, the Customer ledgers agree with them.
 * Returns the problems found, empty when all is well. Changes nothing.
 */
export function checkLedger(
  journal: Journal,
  expected?: ReadonlyMap<string, CustomerBalances>,
): string[] {
  const problems: string[] = [];
  let debits = 0;
  let credits = 0;
  const customers = new Set<string>();
  for (const entry of journal) {
    let d = 0;
    let c = 0;
    for (const line of entry.lines) {
      if (line.side === "debit") d += line.amount;
      else c += line.amount;
      const account = ACCOUNTS[line.account];
      if (account?.perCustomer) {
        if (line.customerId === undefined) {
          problems.push(`Entry ${entry.id}: a ${account.name} line names no Customer.`);
        } else customers.add(line.customerId);
      }
    }
    if (d !== c) problems.push(`Entry ${entry.id}: debits ${d} do not equal credits ${c}.`);
    debits += d;
    credits += c;
  }
  if (debits !== credits) problems.push(`Ledger: debits ${debits} do not equal credits ${credits}.`);

  if (expected) {
    for (const id of new Set([...customers, ...expected.keys()])) {
      const ledger = customerBalances(journal, id);
      const want = expected.get(id) ?? { owes: 0, depositsHeld: 0, creditHeld: 0 };
      const differences = (Object.keys(CUSTOMER_ACCOUNTS) as (keyof CustomerBalances)[])
        .filter((key) => ledger[key] !== want[key])
        .map(
          (key) =>
            `${ACCOUNTS[CUSTOMER_ACCOUNTS[key]].name} is ${ledger[key]} in the ledger but ${want[key]} from the Documents`,
        );
      if (differences.length) problems.push(`Customer ${id}: ${differences.join("; ")}.`);
    }
  }
  return problems;
}
