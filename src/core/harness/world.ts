import type { CustomerBalances } from "../checks";
import { emptyJournal, type EntryInput, type Journal } from "../ledger";
import type { Cents } from "../money";

/**
 * The harness's model of a Business's records: just enough of the Documents to work out
 * the seven rules independently of the ledger. Records are never removed; a cancelled one
 * is marked inactive. Later tickets add fields here as they add events.
 */
export interface World {
  journal: Journal;
  /** Days since the harness start date; entries are dated from it. */
  day: number;
  customers: readonly string[];
  /** Issued Invoices and Opening balance items owed. */
  invoices: readonly InvoiceRecord[];
  payments: readonly PaymentRecord[];
  refunds: readonly RefundRecord[];
  writeOffs: readonly WriteOffRecord[];
  /** Deposits and Credit held per Customer, as the Documents show them. */
  held: Readonly<Record<string, Held>>;
  /** Credit held that came in as an Opening balance, not as money received. */
  openingCredit: Cents;
}

export interface Held {
  deposits: Cents;
  credit: Cents;
}

export interface InvoiceRecord {
  id: string;
  kind: "invoice" | "opening";
  customerId: string;
  total: Cents;
  /** Money applied to it: from Payments, Deposits or Credit. */
  applied: Cents;
  writtenOff: Cents;
  active: boolean;
  entryId: string;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  amount: Cents;
  toInvoices: readonly { invoiceId: string; amount: Cents }[];
  toDeposits: Cents;
  toCredit: Cents;
  active: boolean;
  entryId: string;
  /** Entries posted later in the same save, such as money held until the Invoice date, then applied. */
  laterEntryIds?: readonly string[];
}

export interface RefundRecord {
  id: string;
  customerId: string;
  from: "deposit" | "credit";
  amount: Cents;
  active: boolean;
  entryId: string;
}

export interface WriteOffRecord {
  id: string;
  invoiceId: string;
  amount: Cents;
  active: boolean;
  entryId: string;
}

export function initialWorld(customers: readonly string[] = ["c1", "c2", "c3"]): World {
  return {
    journal: emptyJournal,
    day: 0,
    customers,
    invoices: [],
    payments: [],
    refunds: [],
    writeOffs: [],
    held: Object.fromEntries(customers.map((c) => [c, { deposits: 0, credit: 0 }])),
    openingCredit: 0,
  };
}

/** A domain rule refused the event (as the app would). The world must be left as it was. */
export class Refused extends Error {
  override name = "Refused";
}

export function accountingDate(world: World): string {
  return new Date(Date.UTC(2026, 0, 1 + world.day)).toISOString().slice(0, 10);
}

/** The id, dates and source for the next entry posted in this world. */
export function entryMeta(world: World, kind: string, sourceId: string): Omit<EntryInput, "lines"> {
  const date = accountingDate(world);
  return {
    id: `e${world.journal.length + 1}`,
    accountingDate: date,
    recordedAt: `${date}T09:00:00Z`,
    source: { kind, id: sourceId },
  };
}

export function invoiceBalance(invoice: InvoiceRecord): Cents {
  return invoice.active ? invoice.total - invoice.applied - invoice.writtenOff : 0;
}

/** Each Customer's balances worked out from the Documents, never from the ledger. */
export function documentBalances(world: World): Map<string, CustomerBalances> {
  return new Map(
    world.customers.map((c) => [
      c,
      {
        owes: world.invoices
          .filter((i) => i.customerId === c)
          .reduce((sum, i) => sum + invoiceBalance(i), 0),
        depositsHeld: world.held[c]?.deposits ?? 0,
        creditHeld: world.held[c]?.credit ?? 0,
      },
    ]),
  );
}

/** Valid Payments - valid Refunds. */
export function netMoneyReceived(world: World): Cents {
  const paid = world.payments.filter((p) => p.active).reduce((s, p) => s + p.amount, 0);
  const refunded = world.refunds.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
  return paid - refunded;
}

export function replaceById<T extends { id: string }>(list: readonly T[], id: string, change: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...change } : item));
}

export function withHeld(world: World, customerId: string, change: Partial<Held>): World["held"] {
  return { ...world.held, [customerId]: { ...world.held[customerId]!, ...change } };
}
