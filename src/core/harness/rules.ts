import { MONEY_ACCOUNTS } from "../accounts";
import { checkLedger, customerBalances } from "../checks";
import { accountBalance } from "../ledger";
import { documentBalances, invoiceBalance, netMoneyReceived, type World } from "./world";

export interface StepContext {
  before: World;
  after: World;
  /** The step was refused, so `after` is `before`. */
  refused: boolean;
  /** `before` as it was, serialised before the step ran. */
  snapshot: string;
}

/** One rule that must hold after every step. Returns the problems found, empty when it holds. */
export interface Rule {
  name: string;
  check(step: StepContext): string[];
}

const moneyInLedger = (w: World) => MONEY_ACCOUNTS.reduce((s, a) => s + accountBalance(w.journal, a), 0);

/** The seven rules of spec section 6, plus the ledger checks of section 9. */
export const RULES: readonly Rule[] = [
  {
    name: "Rule 1: net money received = applied to active Invoices + unused Deposits + Credit",
    check: ({ after: w }) => {
      const received = netMoneyReceived(w);
      const applied = w.invoices.filter((i) => i.active).reduce((s, i) => s + i.applied, 0);
      const held = Object.values(w.held).reduce((s, h) => s + h.deposits + h.credit, 0);
      const ledger = moneyInLedger(w);
      const problems: string[] = [];
      if (received + w.openingCredit !== applied + held) {
        problems.push(`received ${received} (+ opening Credit ${w.openingCredit}) but applied ${applied} + held ${held}`);
      }
      if (ledger !== received) problems.push(`money accounts hold ${ledger} but net received is ${received}`);
      return problems;
    },
  },
  {
    name: "Rule 2: balance owed = active Invoices + Opening balance items - applied - Write-offs",
    check: ({ after: w }) =>
      w.customers.flatMap((c) => {
        const owed = w.invoices.filter((i) => i.customerId === c).reduce((s, i) => s + invoiceBalance(i), 0);
        const ledger = customerBalances(w.journal, c).owes;
        return owed === ledger ? [] : [`${c} owes ${owed} by the Documents, ${ledger} by the ledger`];
      }),
  },
  {
    name: "Rule 3: Deposits and Credit are held for the Customer, apart from debt",
    check: ({ after: w }) =>
      w.customers.flatMap((c) => {
        const ledger = customerBalances(w.journal, c);
        const held = w.held[c]!;
        const problems: string[] = [];
        if (ledger.depositsHeld !== held.deposits || ledger.creditHeld !== held.credit) {
          problems.push(
            `${c} holds ${held.deposits}/${held.credit} by the Documents, ${ledger.depositsHeld}/${ledger.creditHeld} by the ledger`,
          );
        }
        if (held.deposits < 0 || held.credit < 0) problems.push(`${c} holds a negative amount`);
        return problems;
      }),
  },
  {
    name: "Rule 4: no entry is zero or negative; nothing applied beyond a balance or twice",
    check: ({ after: w }) => [
      ...w.journal.flatMap((e) =>
        e.lines.filter((l) => !Number.isSafeInteger(l.amount) || l.amount <= 0).map(() => `entry ${e.id} has a bad amount`),
      ),
      ...w.invoices
        .filter((i) => i.applied < 0 || i.writtenOff < 0 || i.applied + i.writtenOff > i.total)
        .map((i) => `${i.id} has ${i.applied} applied and ${i.writtenOff} written off of ${i.total}`),
    ],
  },
  {
    name: "Rule 5: a refused step saves nothing",
    check: ({ before, after, refused, snapshot }) =>
      refused && (before !== after || JSON.stringify(before) !== snapshot)
        ? ["a refused step changed the records"]
        : [],
  },
  {
    name: "Rule 6: applied Receipts, Quotations and Drafts never count as money received",
    check: ({ before, after }) => {
      const moved = moneyInLedger(after) - moneyInLedger(before);
      const received = netMoneyReceived(after) - netMoneyReceived(before);
      return moved === received ? [] : [`money accounts moved ${moved} but money received moved ${received}`];
    },
  },
  {
    name: "Rule 7: nothing Issued or recorded is erased",
    check: ({ before, after }) => {
      const problems: string[] = [];
      const kept = before.journal.every((e, i) => JSON.stringify(after.journal[i]) === JSON.stringify(e));
      if (!kept || after.journal.length < before.journal.length) problems.push("a journal entry was changed or erased");
      for (const key of ["invoices", "payments", "refunds", "writeOffs"] as const) {
        const ids = new Set(after[key].map((r) => r.id));
        if (before[key].some((r) => !ids.has(r.id))) problems.push(`a record was erased from ${key}`);
      }
      return problems;
    },
  },
  {
    name: "Ledger checks: debits equal credits and Customer ledgers agree with the Documents",
    check: ({ after: w }) => checkLedger(w.journal, documentBalances(w)),
  },
];
