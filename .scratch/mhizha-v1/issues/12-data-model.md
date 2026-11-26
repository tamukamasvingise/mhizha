# Data model

Label: wayfinder:grilling
Type: grilling
Status: open
Blocked by: 04, 06, 07, 10, 18, 19

## Question

What tables, unique IDs, snapshots of customer and business details on Issued Documents, PDF storage and database-upgrade rules does the app need so that syncing can be added later?

From Money and VAT rules: hold the fiscalisation and VAT provisions listed there, including time zone, tax status, tax numbers and structured address.

From Accounting foundation: hold accounts, immutable balanced entries with accounting date and recorded time, accounting periods and their settings history, review items and answers, and payment methods.

From Opening balances: hold the Start date, Opening balance items (old invoice number, date, amount, note, optional Job, cancellation), their applications, and the monthly sales totals before the Start date.

From Signing and delivery: before upgrading its database on first open after an update, the app keeps a copy on the phone and returns to it if the upgrade fails.
