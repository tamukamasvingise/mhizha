# 09: Payments and Receipts

**What to build:** The User records a Payment against one or more of a Customer's Invoices and the Receipt and its PDF are issued automatically. Spec section 6. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 08 Invoice PDF

**Status:** ready-for-agent

- [ ] Ticked Invoices fill oldest first; amounts can be changed; part-payment allowed
- [ ] Date received defaults to today, may be earlier, never in the future; a Date received in an earlier year warns
- [ ] Payment methods Cash, Bank transfer, Card (swipe), EcoCash, InnBucks, Other with description; unused methods can be hidden
- [ ] Confirmation screen, then one Receipt (or Separate receipts) with the Receipt PDF
- [ ] Payment, its split, its Receipt and its ledger entry save together or not at all
- [ ] Invoice status worked out: Unpaid, Part-paid, Paid, Overdue
- [ ] Payment events added to the fast-check harness
