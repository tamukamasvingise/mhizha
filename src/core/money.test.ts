import { describe, expect, it } from "vitest";
import { lineAmount } from "./money";

describe("line amount", () => {
  it("is quantity times unit price in whole cents", () => {
    // 2.000 x US$12.50 = US$25.00
    expect(lineAmount(2000, 1250)).toBe(2500);
  });
});
