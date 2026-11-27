/**
 * The chart of accounts. Codes are permanent: accounts are only ever added, never renumbered
 * or removed. The User never sees these names.
 */
export const ACCOUNTS = {
  "1010": { name: "Cash", normal: "debit", perCustomer: false, hidden: false },
  "1020": { name: "Bank", normal: "debit", perCustomer: false, hidden: false },
  "1030": { name: "EcoCash", normal: "debit", perCustomer: false, hidden: false },
  "1040": { name: "InnBucks", normal: "debit", perCustomer: false, hidden: false },
  "1090": { name: "Other money", normal: "debit", perCustomer: false, hidden: false },
  "1100": { name: "Customers owe", normal: "debit", perCustomer: true, hidden: false },
  "1200": { name: "Unbilled work", normal: "debit", perCustomer: false, hidden: true },
  "2100": { name: "Deposits held", normal: "credit", perCustomer: true, hidden: false },
  "2200": { name: "Credit held", normal: "credit", perCustomer: true, hidden: false },
  "2300": { name: "Unearned income", normal: "credit", perCustomer: false, hidden: true },
  "3000": { name: "Owner's equity", normal: "credit", perCustomer: false, hidden: false },
  "3100": { name: "Opening balances", normal: "credit", perCustomer: false, hidden: false },
  "4000": { name: "Sales", normal: "credit", perCustomer: false, hidden: false },
  "5000": { name: "Bad debts", normal: "debit", perCustomer: false, hidden: false },
} as const satisfies Record<
  string,
  { name: string; normal: "debit" | "credit"; perCustomer: boolean; hidden: boolean }
>;

export type AccountCode = keyof typeof ACCOUNTS;

/** Named codes, so callers never write a bare code. */
export const ACCOUNT = {
  cash: "1010",
  bank: "1020",
  ecoCash: "1030",
  innBucks: "1040",
  otherMoney: "1090",
  customersOwe: "1100",
  unbilledWork: "1200",
  depositsHeld: "2100",
  creditHeld: "2200",
  unearnedIncome: "2300",
  ownersEquity: "3000",
  openingBalances: "3100",
  sales: "4000",
  badDebts: "5000",
} as const satisfies Record<string, AccountCode>;

export const PAYMENT_METHODS = ["cash", "bank-transfer", "card", "ecocash", "innbucks", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const MONEY_ACCOUNT: Record<PaymentMethod, AccountCode> = {
  cash: ACCOUNT.cash,
  "bank-transfer": ACCOUNT.bank,
  card: ACCOUNT.bank,
  ecocash: ACCOUNT.ecoCash,
  innbucks: ACCOUNT.innBucks,
  other: ACCOUNT.otherMoney,
};

/** Each Payment method has its own money account, except Bank transfer and Card, which share Bank. */
export function moneyAccountFor(method: PaymentMethod): AccountCode {
  return MONEY_ACCOUNT[method];
}

export const MONEY_ACCOUNTS: readonly AccountCode[] = [...new Set(Object.values(MONEY_ACCOUNT))];

/** Each Payment method as the User sees it, and as the Receipt prints it. */
export const PAYMENT_METHOD_NAMES: Record<PaymentMethod, string> = {
  cash: "Cash",
  "bank-transfer": "Bank transfer",
  card: "Card (swipe)",
  ecocash: "EcoCash",
  innbucks: "InnBucks",
  other: "Other",
};
