# 13: Cancel, replace and Write-off

**What to build:** The User can cancel any Issued Document with a reason, cancel and replace an Invoice, and write off a remainder that will never be paid. Spec sections 6 and 10. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 12 Credit and Refunds

**Status:** ready-for-agent

- [ ] Cancelling needs a reason, counts on the day it is made, and posts the exact reverse
- [ ] Cancelling an Invoice keeps its Payments and money Receipts, cancels its applied Receipts and returns money to the Deposit or Credit
- [ ] Cancel and replace opens a Draft copy and suggests the released money
- [ ] Cancelling a money Receipt cancels its Payment and reopens its Invoices; refused while the money is used or refunded, listing what to undo first; Refunds can be cancelled
- [ ] CANCELLED stamp on every page with date, reason and replacement number, never adding a page; the original PDF is kept
- [ ] Write-off with a reason, undoable, closes the Invoice; must be undone before later money is applied; reversed if its Invoice is Cancelled
- [ ] Cancel and Write-off events added to the fast-check harness
