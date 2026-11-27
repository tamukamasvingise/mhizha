// Ticket 14's events for the fast-check harness, as src/opening does them: an
// Opening balance of Credit held recorded as an item, an item Cancelled with a
// reverse on the day (refused while money is applied to it or its Credit is
// used), and an item's Credit made the Deposit of a re-created Quotation.
// Opening balance items owed come from the core event of the same name; the
// Payment events pay them like Invoices.
import { post, postings, reverse } from '../core';
import type { HarnessEvent } from '../core/harness/harness';
import { entryMeta, Refused, replaceById, withHeld, type OpeningCreditRecord, type World } from '../core/harness/world';

const credits = (w: World): readonly OpeningCreditRecord[] => w.openingCredits ?? [];

function correction(world: World) {
  const { id, accountingDate, recordedAt } = entryMeta(world, '', '');
  return { id, accountingDate, recordedAt };
}

export const openingCreditItem: HarnessEvent = {
  name: 'Opening balance item of Credit held',
  plan: (world, pick) => {
    const customerId = pick.oneOf(world.customers);
    const amount = pick.int(1, 50_000);
    return {
      describe: `Opening balance item of ${amount} Credit held for ${customerId}`,
      run: (w) => {
        const id = `obc${credits(w).length + 1}`;
        const meta = entryMeta(w, 'opening-balance', id);
        const journal = post(w.journal, { ...meta, lines: postings.openingCredit({ customerId, amount }) });
        return {
          ...w,
          journal,
          held: withHeld(w, customerId, { credit: w.held[customerId]!.credit + amount }),
          openingCredit: w.openingCredit + amount,
          openingCredits: [...credits(w), { id, customerId, amount, madeDeposit: 0, active: true, entryId: meta.id }],
        };
      },
    };
  },
};

export const cancelOpeningItem: HarnessEvent = {
  name: 'Opening balance item Cancelled',
  plan: (world, pick) => {
    const owed = world.invoices.filter((i) => i.kind === 'opening' && i.active).map((i) => ({ kind: 'owed' as const, id: i.id }));
    const held = credits(world).filter((c) => c.active).map((c) => ({ kind: 'credit' as const, id: c.id }));
    if (!owed.length && !held.length) return null;
    const target = pick.oneOf([...owed, ...held]);
    return {
      describe: `cancel Opening balance item ${target.id}`,
      run: (w) => {
        if (target.kind === 'owed') {
          const item = w.invoices.find((i) => i.id === target.id)!;
          if (item.applied > 0 || item.writtenOff > 0) throw new Refused('a Payment was applied to it');
          return {
            ...w,
            journal: reverse(w.journal, item.entryId, correction(w)),
            invoices: replaceById(w.invoices, item.id, { active: false }),
          };
        }
        const item = credits(w).find((c) => c.id === target.id)!;
        if (item.madeDeposit > 0) throw new Refused('its Credit is used');
        // The ledger refuses it when the Credit it brought in has been applied or refunded.
        const journal = reverse(w.journal, item.entryId, correction(w));
        return {
          ...w,
          journal,
          held: withHeld(w, item.customerId, { credit: w.held[item.customerId]!.credit - item.amount }),
          openingCredit: w.openingCredit - item.amount,
          openingCredits: replaceById(credits(w), item.id, { active: false }),
        };
      },
    };
  },
};

export const openingCreditToDeposit: HarnessEvent = {
  name: "Opening Credit made a Quotation's Deposit",
  plan: (world) => {
    const open = credits(world).filter((c) => c.active && c.madeDeposit < c.amount);
    if (!open.length) return null;
    const item = open[0]!;
    return {
      describe: `make what is left of ${item.id} a Deposit`,
      run: (w) => {
        const current = credits(w).find((c) => c.id === item.id)!;
        const amount = current.amount - current.madeDeposit;
        // The ledger refuses it if the Customer's Credit held is less (used elsewhere).
        const journal = post(w.journal, {
          ...entryMeta(w, 'opening-balance', item.id),
          lines: postings.creditToDeposit({ customerId: item.customerId, amount }),
        });
        const h = w.held[item.customerId]!;
        return {
          ...w,
          journal,
          held: withHeld(w, item.customerId, { credit: h.credit - amount, deposits: h.deposits + amount }),
          openingCredits: replaceById(credits(w), item.id, { madeDeposit: current.amount }),
        };
      },
    };
  },
};

export const openingEvents: readonly HarnessEvent[] = [openingCreditItem, cancelOpeningItem, openingCreditToDeposit];
