import { describe, expect, it } from "vitest";
import { formatQuantity, formatUsd, parsePercent, parseQuantity, parseUsd } from "./amounts";

describe("showing an amount", () => {
  it("writes US dollars with thousands commas and two decimals", () => {
    expect(formatUsd(0)).toBe("US$0.00");
    expect(formatUsd(5)).toBe("US$0.05");
    expect(formatUsd(4500)).toBe("US$45.00");
    expect(formatUsd(123456)).toBe("US$1,234.56");
    expect(formatUsd(100000000)).toBe("US$1,000,000.00");
  });

  it("writes a negative amount with a minus sign", () => {
    expect(formatUsd(-2580)).toBe("−US$25.80");
  });
});

describe("reading a typed amount", () => {
  it("reads dollars and cents into whole cents", () => {
    expect(parseUsd("45")).toEqual({ ok: true, cents: 4500 });
    expect(parseUsd("3.5")).toEqual({ ok: true, cents: 350 });
    expect(parseUsd("0.07")).toEqual({ ok: true, cents: 7 });
    expect(parseUsd(" 1,234.56 ")).toEqual({ ok: true, cents: 123456 });
    expect(parseUsd("US$12.00")).toEqual({ ok: true, cents: 1200 });
    expect(parseUsd(".50")).toEqual({ ok: true, cents: 50 });
    expect(parseUsd("0")).toEqual({ ok: true, cents: 0 });
  });

  it("refuses empty, negative, part-cent and non-number text with a plain message", () => {
    for (const text of ["", "  ", "-5", "1.234", "abc", "1.2.3", "1e3", "12,34"]) {
      const r = parseUsd(text);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.message).toBe("Enter an amount in US dollars, like 45 or 12.50.");
    }
  });

  it("refuses amounts too big to keep exactly", () => {
    const r = parseUsd("100000000000000");
    expect(r.ok).toBe(false);
  });
});

describe("reading a typed quantity", () => {
  it("reads up to three decimals into thousandths", () => {
    expect(parseQuantity("3")).toEqual({ ok: true, thousandths: 3000 });
    expect(parseQuantity("1.5")).toEqual({ ok: true, thousandths: 1500 });
    expect(parseQuantity(" 0.125 ")).toEqual({ ok: true, thousandths: 125 });
    expect(parseQuantity(".25")).toEqual({ ok: true, thousandths: 250 });
  });

  it("refuses zero, more than three decimals and words", () => {
    for (const bad of ["", "0", "0.000", "1.2345", "two", "-1", "1,5"]) {
      expect(parseQuantity(bad).ok).toBe(false);
    }
    expect(parseQuantity("0")).toEqual({ ok: false, message: "Enter a quantity above zero, like 1 or 2.5." });
  });

  it("writes a quantity with only the decimals it needs", () => {
    expect(formatQuantity(3000)).toBe("3");
    expect(formatQuantity(1500)).toBe("1.5");
    expect(formatQuantity(125)).toBe("0.125");
    expect(formatQuantity(2050)).toBe("2.05");
  });
});

describe("reading a typed Discount percentage", () => {
  it("reads 0 to 99.9 into tenths", () => {
    expect(parsePercent("10")).toEqual({ ok: true, tenths: 100 });
    expect(parsePercent("12.5")).toEqual({ ok: true, tenths: 125 });
    expect(parsePercent("99.9")).toEqual({ ok: true, tenths: 999 });
    expect(parsePercent("0")).toEqual({ ok: true, tenths: 0 });
    expect(parsePercent("7%")).toEqual({ ok: true, tenths: 70 });
  });

  it("refuses 100 and more, two decimals and words, with the spec's message", () => {
    for (const bad of ["100", "99.95", "", "ten", "-5"]) {
      expect(parsePercent(bad)).toEqual({ ok: false, message: "Enter a percentage from 0 to 99.9." });
    }
  });
});
