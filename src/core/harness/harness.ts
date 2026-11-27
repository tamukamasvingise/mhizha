/**
 * The fast-check harness for the money core. It runs random sequences of events against a
 * model of the records (`World`) and the real ledger, and checks the seven rules after every step.
 *
 * To add a ticket's events: write `HarnessEvent`s beside its code (see `events.ts` for the
 * pattern), add any fields the model needs to `World`, and run
 * `runSequences({ events: [...coreEvents, ...yours] })`. A step refuses by throwing
 * `Refused`, `LedgerError` or `MoneyError`; it must then leave the world untouched.
 */
import fc from "fast-check";
import { LedgerError } from "../ledger";
import { MoneyError } from "../money";
import { RULES, type Rule } from "./rules";
import { initialWorld, Refused, type World } from "./world";

/** Random choices for an event, drawn by fast-check so failures shrink. */
export interface Pick {
  int(min: number, max: number): number;
  oneOf<T>(items: readonly T[]): T;
  chance(percent: number): boolean;
}

/** One planned step: what it is, and how it changes the world. `run` throws to refuse. */
export interface Step {
  describe: string;
  run(world: World): World;
}

/**
 * A kind of thing that can happen to the records. `plan` draws its details, or returns null
 * when it can't happen in this world. Later tickets add their events to the list they run.
 */
export interface HarnessEvent {
  name: string;
  plan(world: World, pick: Pick): Step | null;
}

function isRefusal(error: unknown): boolean {
  return error instanceof Refused || error instanceof LedgerError || error instanceof MoneyError;
}

/**
 * Run random sequences of events and check every rule after every step.
 * Throws, with the steps taken, on the first step that breaks a rule.
 */
export function runSequences(options: {
  events: readonly HarnessEvent[];
  rules?: readonly Rule[];
  numRuns?: number;
  maxSteps?: number;
  start?: () => World;
}): void {
  const { events, rules = RULES, numRuns = 200, maxSteps = 30, start = () => initialWorld() } = options;
  const details = fc.check(
    fc.property(fc.gen(), (g) => {
      const pick: Pick = {
        int: (min, max) => g(fc.integer, { min, max }),
        oneOf: (items) => items[g(fc.integer, { min: 0, max: items.length - 1 })]!,
        chance: (percent) => g(fc.integer, { min: 1, max: 100 }) <= percent,
      };
      let world = start();
      const history: string[] = [];
      const steps = pick.int(1, maxSteps);
      for (let i = 0; i < steps; i++) {
        const step = pick.oneOf(events).plan(world, pick);
        if (!step) continue;
        const snapshot = JSON.stringify(world);
        let after = world;
        let refused = false;
        try {
          after = step.run(world);
        } catch (error) {
          if (!isRefusal(error)) throw error;
          refused = true;
        }
        history.push(`${refused ? "refused: " : ""}${step.describe}`);
        const problems = rules.flatMap((rule) =>
          rule.check({ before: world, after, refused, snapshot }).map((p) => `${rule.name}: ${p}`),
        );
        if (problems.length) {
          throw new Error(`${problems.join("\n")}\nSteps:\n  ${history.join("\n  ")}`);
        }
        world = after;
      }
    }),
    { numRuns },
  );
  if (details.failed) {
    const reason = details.errorInstance instanceof Error ? details.errorInstance.message : String(details.errorInstance);
    throw new Error(`${reason}

fast-check: seed ${details.seed}, path ${details.counterexamplePath}`);
  }
}
