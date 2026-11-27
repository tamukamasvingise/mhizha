// Amounts as the User sees and types them: "US$1,234.56". Whole cents inside,
// never floating-point dollars.
import type { Cents, Thousandths } from "./money";

/** "US$1,234.56"; a negative amount starts with a minus sign (U+2212). */
export function formatUsd(cents: Cents): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}US$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export type ParsedAmount = { ok: true; cents: Cents } | { ok: false; message: string };

const typed = /^(?:US\$)?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{1,2}))?$/;

/** Reads a typed amount in US dollars ("45", "12.50", "1,234.56") into whole cents, zero or more. */
export function parseUsd(text: string): ParsedAmount {
  const m = typed.exec(text.trim());
  if (!m || (m[1] === "" && m[2] === undefined)) {
    return { ok: false, message: "Enter an amount in US dollars, like 45 or 12.50." };
  }
  const dollars = (m[1] ?? "").replace(/,/g, "");
  if (dollars.length > 9) return { ok: false, message: "Enter an amount below US$1,000,000,000." };
  const cents = Number(dollars || "0") * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return { ok: true, cents };
}

export type ParsedQuantity = { ok: true; thousandths: Thousandths } | { ok: false; message: string };

const typedQuantity = /^(\d{0,9})(?:\.(\d{1,3}))?$/;

/** Reads a typed quantity ("3", "1.5", "0.125") into thousandths, above zero, at most three decimals. */
export function parseQuantity(text: string): ParsedQuantity {
  const m = typedQuantity.exec(text.trim());
  const message = "Enter a quantity above zero, like 1 or 2.5.";
  if (!m || (m[1] === "" && m[2] === undefined)) return { ok: false, message };
  const thousandths = Number(m[1] || "0") * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
  return thousandths > 0 ? { ok: true, thousandths } : { ok: false, message };
}

/** "3", "1.5", "0.125": a quantity with only the decimals it needs. */
export function formatQuantity(q: Thousandths): string {
  const whole = Math.floor(q / 1000);
  const rest = String(q % 1000).padStart(3, "0").replace(/0+$/, "");
  return rest ? `${whole}.${rest}` : String(whole);
}

export type ParsedPercent = { ok: true; tenths: number } | { ok: false; message: string };

const typedPercent = /^(\d{1,2})(?:\.(\d))?%?$/;

/** Reads a typed Discount percentage, 0 to 99.9, into tenths: "12.5" is 125. */
export function parsePercent(text: string): ParsedPercent {
  const m = typedPercent.exec(text.trim());
  if (!m) return { ok: false, message: "Enter a percentage from 0 to 99.9." };
  return { ok: true, tenths: Number(m[1]) * 10 + Number(m[2] ?? "0") };
}
