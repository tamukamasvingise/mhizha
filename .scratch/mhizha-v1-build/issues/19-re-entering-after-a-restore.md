# 19: Re-entering after a restore

**What to build:** After a Restore the User accounts for every number issued after the Backup by entering it again or marking it Lost. Spec section 11 and Re-entering records after a restore. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 16 Review and period-end adjustments, 18 Restore

**Status:** ready-for-agent

- [ ] One Review item per type lists the missing numbers, each with Enter again and Mark as lost, open until every number is dealt with
- [ ] Enter again opens a Draft set to that number with the original issue date between the Backup and the Restore; it posts on that date; the PDF says "Re-entered on … after a restore."
- [ ] Receipts, Refunds and Quotations work the same way; Invoices are suggested first
- [ ] "Details lost after a restore" one-line form with the real total
- [ ] Mark as lost needs a reason, carries no money, and can be undone into Enter again
