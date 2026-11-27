/** Whole US cents. Never a fraction. */
export type Cents = number;
/** A quantity in thousandths: 1.5 is 1500. */
export type Thousandths = number;

/** A money rule was broken. The message is fit to show the User. */
export class MoneyError extends Error {
  override name = "MoneyError";
}

function wholeNonNegative(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MoneyError(`${what} must be a whole number, zero or more.`);
  }
}

/** Quantity x unit price, rounded to the nearest cent, half a cent up. */
export function lineAmount(quantity: Thousandths, unitPrice: Cents): Cents {
  wholeNonNegative(quantity, "Quantity in thousandths");
  wholeNonNegative(unitPrice, "Unit price in cents");
  const product = BigInt(quantity) * BigInt(unitPrice);
  return Number((product + 500n) / 1000n);
}

export interface Line {
  quantity: Thousandths;
  unitPrice: Cents;
}

export interface Totals {
  lineAmounts: Cents[];
  subtotal: Cents;
  discount: Cents;
  /** Not registered for VAT in version 1: printed blank, never 0.00. */
  vat: null;
  total: Cents;
}

/** One per Quotation or Invoice. A percentage is held in tenths: 12.5% is 125. */
export type Discount = { kind: "amount"; cents: Cents } | { kind: "percent"; tenths: number };

const PERCENT_MESSAGE = "Enter a percentage from 0 to 99.9.";

/** The Discount in cents on a Subtotal. Refused above the Subtotal. */
export function discountAmount(discount: Discount, subtotal: Cents): Cents {
  let cents: Cents;
  if (discount.kind === "percent") {
    const t = discount.tenths;
    if (!Number.isInteger(t) || t < 0 || t > 999) throw new MoneyError(PERCENT_MESSAGE);
    cents = Number((BigInt(subtotal) * BigInt(t) + 500n) / 1000n);
  } else {
    wholeNonNegative(discount.cents, "Discount in cents");
    cents = discount.cents;
  }
  if (cents > subtotal) throw new MoneyError("The Discount can't be more than the Subtotal.");
  return cents;
}

/** "Discount (10%)" for a percentage, "Discount" for an amount. */
export function discountLabel(discount: Discount): string {
  if (discount.kind === "amount") return "Discount";
  const whole = Math.floor(discount.tenths / 10);
  const tenth = discount.tenths % 10;
  return `Discount (${tenth === 0 ? whole : `${whole}.${tenth}`}%)`;
}

/** Lines, Subtotal, Discount, VAT and Total of a Quotation or Invoice. */
export function documentTotals(input: { lines: readonly Line[]; discount?: Discount }): Totals {
  const lineAmounts = input.lines.map((l) => lineAmount(l.quantity, l.unitPrice));
  const subtotal = lineAmounts.reduce((a, b) => a + b, 0);
  const discount = input.discount ? discountAmount(input.discount, subtotal) : 0;
  return { lineAmounts, subtotal, discount, vat: null, total: subtotal - discount };
}

/**
 * The share of a Quotation's Discount an Invoice from it takes:
 * Discount x Invoice Subtotal / Quotation Subtotal, rounded to the cent; the last Invoice
 * takes the leftover cents. Never more than is left of the Discount or than the Invoice Subtotal.
 */
export function discountShare(input: {
  discount: Cents;
  quotationSubtotal: Cents;
  invoiceSubtotal: Cents;
  /** Cents of the Discount already taken by earlier Invoices from the Quotation. */
  alreadyTaken: Cents;
  last: boolean;
}): Cents {
  const { discount, quotationSubtotal, invoiceSubtotal, alreadyTaken, last } = input;
  for (const [v, what] of [
    [discount, "Discount"],
    [quotationSubtotal, "Quotation Subtotal"],
    [invoiceSubtotal, "Invoice Subtotal"],
    [alreadyTaken, "Discount already taken"],
  ] as const) {
    wholeNonNegative(v, what);
  }
  const left = Math.max(0, discount - alreadyTaken);
  const share =
    last || quotationSubtotal === 0
      ? left
      : Number(
          (BigInt(discount) * BigInt(invoiceSubtotal) * 2n + BigInt(quotationSubtotal)) /
            (2n * BigInt(quotationSubtotal)),
        );
  return Math.min(share, left, invoiceSubtotal);
}
