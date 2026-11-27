// Amounts as the User sees and types them: "US$1,234.56". Whole cents inside,
// never floating-point dollars.
import type { Cents } from "./money";

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
