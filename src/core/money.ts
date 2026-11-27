/** Whole US cents. Never a fraction. */
export type Cents = number;
/** A quantity in thousandths: 1.5 is 1500. */
export type Thousandths = number;

/** Quantity x unit price, rounded to the nearest cent, half a cent up. */
export function lineAmount(quantity: Thousandths, unitPrice: Cents): Cents {
  const product = BigInt(quantity) * BigInt(unitPrice);
  return Number((product + 500n) / 1000n);
}
