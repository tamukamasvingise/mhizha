# 08: Invoice PDF

**What to build:** An Issued Invoice has an A4 PDF in the reference layout that the User can share; a Draft can be previewed marked DRAFT. Spec section 10. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 07 First Invoice

**Status:** ready-for-agent

- [ ] One A4 layout made with expo-print; the app does its own pagination, with "continued" headers and "Page n of N"
- [ ] Letterhead, Customer beside Site / Job, lines table, totals with the sum in words, blank VAT row, payment details, signature line, footer
- [ ] Empty optional fields are left off; Business colour, font and watermark applied
- [ ] Made once at issue, kept as a file with a checksum, never overwritten; Drafts rebuilt on each preview and can't be shared
- [ ] Shared through the Share menu
- [ ] PDF content tested through the page it is made from (totals, number, Discount, VAT)
