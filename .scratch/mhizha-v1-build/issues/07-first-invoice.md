# 07: First Invoice

**What to build:** The User makes an Invoice with no Quotation, step by step (who, which Job, the lines, then check and issue), and sees what the Customer owes. Spec sections 3, 6, 7 and 9. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 03 Money and ledger core, 04 Setup, 05 Customers, Sites and Jobs, 06 Price list

**Status:** ready-for-agent

- [ ] Draft with no number, can be deleted; lines from the Price list or typed, editable per Document; one Discount
- [ ] Issuing gives the next INV number, sets the issue date and time, locks it, keeps a frozen copy of Business, Customer, Site and Job details, and records tax status "not registered"
- [ ] Issuing is blocked while the phone clock is earlier than the last recorded entry
- [ ] Issuing posts Customers owe / Sales in the same save
- [ ] Documents list (Drafts first, then newest Issued, with filters); Customer balance; Home shows "Customers owe you"
- [ ] Due date defaults to the issue date; optional Order No.
