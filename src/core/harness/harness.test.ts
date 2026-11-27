import { describe, expect, it } from "vitest";
import { post } from "../ledger";
import { postings } from "../postings";
import { coreEvents } from "./events";
import { runSequences, type HarnessEvent } from "./harness";
import { entryMeta } from "./world";

describe("random sequences of money events", () => {
  it("keep the seven rules and a balanced ledger after every step", () => {
    runSequences({ events: coreEvents, numRuns: 400, maxSteps: 40 });
  });

  it("catch an event that posts money without recording it", () => {
    const silentPayment: HarnessEvent = {
      name: "payment the Documents never see",
      plan: (world, pick) => {
        const customerId = pick.oneOf(world.customers);
        return {
          describe: `silent payment for ${customerId}`,
          run: (w) => ({
            ...w,
            journal: post(w.journal, {
              ...entryMeta(w, "payment", "silent"),
              lines: postings.payment({ customerId, method: "cash", toCredit: 100 }),
            }),
          }),
        };
      },
    };
    expect(() => runSequences({ events: [...coreEvents, silentPayment], numRuns: 50, maxSteps: 10 })).toThrow(
      /Rule [13]/,
    );
  });

  it("catch an event that erases an entry", () => {
    const eraser: HarnessEvent = {
      name: "erase the last entry",
      plan: (world) =>
        world.journal.length === 0
          ? null
          : { describe: "erase", run: (w) => ({ ...w, journal: w.journal.slice(0, -1) }) },
    };
    expect(() => runSequences({ events: [...coreEvents, eraser], numRuns: 50, maxSteps: 20 })).toThrow(/Rule 7/);
  });
});
