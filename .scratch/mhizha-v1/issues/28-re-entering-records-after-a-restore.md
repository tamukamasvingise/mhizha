# Re-entering records after a restore

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

After a Restore, the User enters the last number of each type issued after the Backup, and the missing numbers become Review items. How are those Documents and the money they recorded entered again: re-issued under their original numbers, recorded as something like Opening balance items, or only noted? Keep every rule that must always hold, never reuse a number, and keep room for later fiscal numbering with no gaps.

## Answer

Decided with the owner on 2026-11-27. The accounting follows principles of accounts: every issued number is accounted for, each record is entered in the period it happened from its source copy (the PDF the Customer received), and no number is reused.

- **Review item:** after a Restore, one item per type lists the missing numbers ("INV-0045 to INV-0047 were issued after your last Backup."). Each number has **Enter again** and **Mark as lost**. The item stays open until every number is dealt with.
- **Enter again:** opens a Draft already set to that number. The User picks the Customer, enters the original issue date (between the Backup and the Restore) and types the lines from the copy the Customer has. Issuing posts it normally, on its original date. The new PDF carries one small line: "Re-entered on 27/11/2026 after a restore."
- **Other types:** Receipts, Refunds and Quotations are entered again the same way, under their own numbers and dates; a Receipt is then applied to its Invoices as usual. The app suggests Invoices first, then Receipts.
- **Details gone:** if no copy survives but the Customer and total are known, the Document is entered again as one line, "Details lost after a restore", with the real total, so money and balances stay right.
- **Mark as lost:** needs a reason. The number stays used and shows as Lost, like a Cancelled number but with no money. Lost can be undone into Enter again if a copy turns up. Every number stays accounted for, keeping room for gap-free fiscal numbering later.
- Glossary: **Lost** added.
