# 14: Opening balances

**What to build:** The User enters what Customers owed, or had in Credit, on the Start date, and the optional monthly sales before it. Spec section 8. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 09 Payments and Receipts

**Status:** ready-for-agent

- [x] Setup step (can be skipped) and adding from a Customer at any time, always dated at the Start date
- [x] Opening balance item: old invoice number or none, date, amount owed, optional note and Job; paid like an Invoice; never Sales
- [x] Opening balance of Credit held, which can become a re-created Quotation's Deposit
- [x] Cancelled with a reason and entered again if wrong
- [x] Wording as in the spec; never "before the app"
- [x] Sales before the Start date: one total per month for the 12 months before it; posts nothing
