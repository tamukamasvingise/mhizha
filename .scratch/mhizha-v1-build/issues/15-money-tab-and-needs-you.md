# 15: Money tab and Needs you

**What to build:** The Money tab shows the business's figures for any date range, Home's "Needs you" lists what to act on, and the VAT threshold warning appears when sales near the limit. Spec sections 3 and 7. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 13 Cancel, replace and Write-off, 14 Opening balances

**Status:** ready-for-agent

- [ ] Money: money received, invoiced sales, money owed, Deposits and Credit held, for any date range; never profit or cash in hand; applied Receipts never count as money received
- [ ] Needs you: overdue Invoices, follow-ups due, and the other items the spec names
- [ ] VAT threshold: last 12 months counting each sale at the earlier of issued or work finished; warns once at US$20,000 and once above US$25,000; says so if the months before the Start date were left blank
- [ ] The VAT notice stays on Home until Got it, then shows only on Money
