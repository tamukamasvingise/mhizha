# Opening balances

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 19

## Question

Old records are not imported, but Customers may already owe the Business, or have paid Deposits, when the app starts. How does version 1 hold those amounts and receipt later Payments against them, without issuing a new Invoice for an old one or counting old money as new?

From Money and VAT rules: also settle sales made in the 12 months before the app starts, or the VAT threshold total starts too low.

From Accounting foundation: opening amounts post against the Opening balances account, never Sales. Decide the accounting period the app starts in.

## Answer

Decided with the owner on 2026-11-26. Not reviewed by an accountant.

### Opening balance items

- A Customer can have one or more Opening balance items: old invoice number (or none), its date, the amount still owed, an optional note and an optional Job.
- An item is not a Document: no number of its own, no PDF. It adds to the Customer's balance owed, is paid like an Invoice, and never counts as Sales or towards the VAT threshold.
- Ledger: debit Customers owe, credit Opening balances.

### Money already held

- Deposits or credit the Business held on the Start date are entered as an Opening balance of Credit held, with a note. Ledger: debit Opening balances, credit Credit held.
- If the Quotation is re-created in the app (new number), that Credit can be attached to it and becomes its Deposit.

### Later Payments

- Ordinary Payments and Receipts. They count as money received, never as Sales.
- Wording, owner's choice: never say "before the app". Use the term itself:
  - Customer screen: "Opening balance · invoice 1234 · 3 March 2026 · US$450.00 owed"
  - Receipt line: "Opening balance (invoice 1234)"
  - Applied Receipt: "Credit applied from opening balance", in place of naming an original Receipt.

### Corrections

- A wrong item is cancelled with a reason (reverse entry) and entered again. A debt never to be paid gets a normal Write-off. Items with money applied follow the same undo-first rule as Receipts.

### Start date and first period

- First setup records a Start date, today by default. Opening balances are dated as at the Start date.
- The first accounting period is the one that contains the Start date, even if partly earlier; the first review comes at its end.
- Opening balances can be added at any time, always dated at the Start date, never later. They are left out of the hidden period-end adjustments.

### Sales before the Start date

- Optional at setup: the Business's sales total for each of the 12 months before the Start date. Used only by the VAT threshold warning; each month drops out as it passes 12 months. Posts nothing to the ledger.
- Left blank: the warning says "This total does not include sales made before your Start date."
