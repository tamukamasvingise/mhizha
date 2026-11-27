import { ACCOUNTS, type AccountCode } from "./accounts";
import type { Cents } from "./money";

export interface EntryLine {
  account: AccountCode;
  side: "debit" | "credit";
  amount: Cents;
  /** Required on per-Customer accounts (Customers owe, Deposits held, Credit held), refused elsewhere. */
  customerId?: string;
}

export interface EntryInput {
  /** Permanent id, unique in the journal. */
  id: string;
  /** The day the entry belongs to: YYYY-MM-DD. */
  accountingDate: string;
  /** The real time it was recorded: ISO 8601 with offset. */
  recordedAt: string;
  /** The Document or record that caused it. */
  source: { kind: string; id: string };
  lines: readonly EntryLine[];
}

export interface Entry extends EntryInput {
  /** Set on a reversing entry: the id of the entry it reverses. */
  reverses?: string;
}

/** The journal: every entry ever posted, oldest first. Never edited; only added to. */
export type Journal = readonly Entry[];

export const emptyJournal: Journal = [];

/** An entry was refused. Nothing was posted. */
export class LedgerError extends Error {
  override name = "LedgerError";
}

/** Post one entry. Returns the new journal; the old one is untouched. Throws LedgerError if refused. */
export function post(journal: Journal, input: EntryInput): Journal {
  return append(journal, { ...input, lines: [...input.lines] });
}

function append(journal: Journal, entry: Entry): Journal {
  refuseUnlessValid(journal, entry);
  return [...journal, entry];
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** True for a real calendar day written YYYY-MM-DD. */
export function isAccountingDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function refuseUnlessValid(journal: Journal, entry: Entry): void {
  const refuse = (why: string): never => {
    throw new LedgerError(`Entry ${entry.id} refused: ${why}.`);
  };
  if (!entry.id) refuse("it has no id");
  if (journal.some((e) => e.id === entry.id)) refuse("the id is already used");
  if (!isAccountingDate(entry.accountingDate)) refuse("the accounting date is not a real YYYY-MM-DD day");
  if (!TIME.test(entry.recordedAt) || Number.isNaN(Date.parse(entry.recordedAt))) {
    refuse("the recorded time is not an ISO 8601 time with an offset");
  }
  if (entry.lines.length < 2) refuse("it needs at least two lines");
  let debits = 0;
  let credits = 0;
  for (const line of entry.lines) {
    const account = ACCOUNTS[line.account as AccountCode] as (typeof ACCOUNTS)[AccountCode] | undefined;
    if (!account) refuse(`account ${line.account} does not exist`);
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) {
      refuse("every amount must be whole cents above zero");
    }
    if (account!.perCustomer && !line.customerId) refuse(`${account!.name} needs a Customer`);
    if (!account!.perCustomer && line.customerId !== undefined) {
      refuse(`${account!.name} is not kept per Customer`);
    }
    if (line.side === "debit") debits += line.amount;
    else if (line.side === "credit") credits += line.amount;
    else refuse("every line is a debit or a credit");
  }
  if (debits !== credits) refuse(`debits ${debits} do not equal credits ${credits}`);

  // Nothing applied beyond a balance: a Customer never owes less than nothing, and the Business
  // never holds less than nothing for a Customer.
  const touched = new Set(
    entry.lines.filter((l) => l.customerId !== undefined).map((l) => `${l.account}|${l.customerId}`),
  );
  const after = [...journal, entry];
  for (const key of touched) {
    const [account, customerId] = key.split("|") as [AccountCode, string];
    if (accountBalance(after, account, { customerId }) < 0) {
      refuse(`${ACCOUNTS[account].name} for Customer ${customerId} would go below nothing`);
    }
  }
}

/**
 * The balance of an account on its normal side (a debit account counts debits as positive),
 * optionally for one Customer and up to an accounting date.
 */
export function accountBalance(
  journal: Journal,
  account: AccountCode,
  options: { customerId?: string; onOrBefore?: string } = {},
): Cents {
  const normal = ACCOUNTS[account].normal;
  let total = 0;
  for (const entry of journal) {
    if (options.onOrBefore && entry.accountingDate > options.onOrBefore) continue;
    for (const line of entry.lines) {
      if (line.account !== account) continue;
      if (options.customerId !== undefined && line.customerId !== options.customerId) continue;
      total += line.side === normal ? line.amount : -line.amount;
    }
  }
  return total;
}
