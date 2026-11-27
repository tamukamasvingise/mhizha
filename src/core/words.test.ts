import { describe, expect, it } from "vitest";
import { sumInWords } from "./words";

describe('"The sum of" in words', () => {
  it.each([
    [15025, "One hundred and fifty US dollars and twenty-five cents only"],
    [100, "One US dollar only"],
    [101, "One US dollar and one cent only"],
    [99, "Ninety-nine cents only"],
    [1100000, "Eleven thousand US dollars only"],
    [100500, "One thousand and five US dollars only"],
    [123456789, "One million, two hundred and thirty-four thousand, five hundred and sixty-seven US dollars and eighty-nine cents only"],
    [2000000000, "Twenty million US dollars only"],
    [7001900, "Seventy thousand and nineteen US dollars only"],
  ])("%i cents reads %s", (cents, words) => {
    expect(sumInWords(cents)).toBe(words);
  });

  it("refuses zero, negatives and fractions", () => {
    expect(() => sumInWords(0)).toThrow();
    expect(() => sumInWords(-5)).toThrow();
    expect(() => sumInWords(1.5)).toThrow();
  });
});
