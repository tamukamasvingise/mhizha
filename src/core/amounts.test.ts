import { describe, expect, it } from "vitest";
import { formatUsd, parseUsd } from "./amounts";

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
