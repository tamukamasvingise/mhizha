# 12: Credit and Refunds

**What to build:** Overpayments become Credit, the User can apply Credit to Invoices, and can refund unused Deposits or Credit. Spec section 6. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 11 Deposits

**Status:** ready-for-agent

- [ ] Overpayment becomes Credit after confirmation
- [ ] Credit is suggested and applied only when the User agrees, with a "Credit applied" Receipt
- [ ] Refund: amount up to what is held, date, method, reason; REF numbers and PDF; posts Deposits or Credit held / Money account
- [ ] Deposits and Credit shown separately on the Customer screen, never set off silently
- [ ] Credit and Refund events added to the fast-check harness
