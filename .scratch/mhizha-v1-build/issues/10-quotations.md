# 10: Quotations

**What to build:** The User issues Quotations, records whether they are accepted, revises them, and turns an accepted Quotation into one or more Invoices. Spec section 6. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 08 Invoice PDF

**Status:** ready-for-agent

- [x] QUO numbers; Issued, Accepted or Declined with a date, Cancelled; Expired worked out from Valid until (30 days default); accepting after expiry warns
- [x] Revisions keep the number (QUO-0012 Rev 2) and supersede the older one; only the latest can be accepted; revising an Accepted Quotation is allowed only before an Invoice comes from it
- [x] Deposit asked and lead time; Quotation PDF with its terms and Revision line
- [x] Invoice from an accepted Quotation copies its lines to a Draft; invoicing an unaccepted one asks to accept first
- [x] Several Invoices from one Quotation, showing invoiced and remaining amounts, warning on going over, with Discount shares
- [x] Quotations post nothing and are never debt
