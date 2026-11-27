# 11: Deposits

**What to build:** The User takes a Deposit on an accepted Quotation, and it is applied automatically when the Invoice is issued. Spec sections 5, 6 and 9. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 09 Payments and Receipts, 10 Quotations

**Status:** ready-for-agent

- [x] A Payment can cover Deposits on the Customer's accepted Quotations; posts to Deposits held
- [x] On issuing an Invoice from its Quotation the Deposit applies up to the Invoice total; the User may reduce it and the rest waits
- [x] "Deposit applied" Receipt naming the original Receipt, no Payment method, kept out of money totals
- [x] Invoice PDF shows "Deposit applied (REC-…)" then Balance due
- [x] Closing a Job with an unused Deposit warns and offers to move it to Credit
- [x] Undoing acceptance, declining or cancelling a Quotation with a Deposit moves the Deposit to Credit first
