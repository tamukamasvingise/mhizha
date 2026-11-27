import { MoneyError, type Cents } from "./money";

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", " thousand", " million", " billion", " trillion"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return TENS[Math.floor(n / 10)]! + (ones ? `-${ONES[ones]}` : "");
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundreds) return belowHundred(rest);
  return `${ONES[hundreds]} hundred` + (rest ? ` and ${belowHundred(rest)}` : "");
}

/** A whole number in British English words: "one thousand and five". */
function numberInWords(n: number): string {
  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  let words = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (!g) continue;
    const part = belowThousand(g) + SCALES[i]!;
    if (!words) words = part;
    else if (i === 0 && g < 100) words += ` and ${part}`;
    else words += `, ${part}`;
  }
  return words;
}

/** "The sum of" wording: "One hundred and fifty US dollars and twenty-five cents only". */
export function sumInWords(amount: Cents): string {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new MoneyError("The sum must be a whole number of cents above zero.");
  }
  const dollars = Math.floor(amount / 100);
  const cents = amount % 100;
  const parts: string[] = [];
  if (dollars) parts.push(`${numberInWords(dollars)} US dollar${dollars === 1 ? "" : "s"}`);
  if (cents) parts.push(`${numberInWords(cents)} cent${cents === 1 ? "" : "s"}`);
  const text = `${parts.join(" and ")} only`;
  return text[0]!.toUpperCase() + text.slice(1);
}
