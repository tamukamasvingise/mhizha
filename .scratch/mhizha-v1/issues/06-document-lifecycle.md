# Document lifecycle

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

What are the exact states and allowed moves of Quotations, Invoices, Payments and Receipts? Settle acceptance and expiry, Revisions, part-payment, overpayment, refunds, Deposits carried to an Invoice, cancelling an Invoice that has Payments, several Invoices per Quotation, and Document numbering.

## Answer

Decided with the owner on 2026-11-25. Items marked (review) were added by the accounting review the owner asked for and follow standard practice.

### Issue, dates and numbers

- A Draft has no number, can be previewed marked DRAFT, and can be deleted. It cannot be shared or printed. Issuing gives it a number and locks it. Issued Documents are never deleted.
- Issue date and time are the real ones, set by the app, not editable. PDFs print the date; the app keeps and shows the time. (review) If the phone clock is earlier than the last recorded entry, the app blocks issuing until the clock is corrected.
- A Payment also has a Date received: defaults to today, may be earlier, never in the future. The Receipt shows both dates only when they differ.
- Numbers use three-letter prefixes, here and for every future Document type: QUO-0001, INV-0001, REC-0001, REF-0001. Separate sequences, never restarted, never reused, including Cancelled ones. The starting number locks after the first Document of that type. (review) Restoring an old backup must not reuse numbers: see Backup and restore.
- Issued Documents keep the customer, site, job and business details they had when Issued. Customers, Sites and Jobs with Issued Documents or Payments can be archived, never deleted.

### Quotation

- Draft, then Issued, then Accepted or Declined (user sets it, with date); Cancelled if issued by mistake. Declined can become Accepted.
- Expired is worked out from Valid until (default 30 days, changeable). It locks nothing; accepting after expiry warns.
- A Revision is Issued under the same number (QUO-0012 Rev 2) and makes the older one Superseded. Only the latest can be accepted. An Accepted Quotation can be revised only before an Invoice is issued from it, and the new Revision must be accepted again; Deposits stay with the Quotation.
- Accepted can be undone, or the Quotation declined or cancelled, only with no active Invoice. A Deposit on it first moves to Credit.

### Invoice

- Copies all Quotation lines to a Draft; the user edits them. One accepted Quotation can have several Invoices. The Quotation shows invoiced and remaining; going over warns. Invoicing an unaccepted Quotation asks to accept it first. An Invoice needs no Quotation.
- Status is worked out, never set by hand: Unpaid, Part-paid, Paid; Overdue if past the due date with money owing; Closed if a Write-off covers the remainder. Due date defaults to the issue date.
- The Issued PDF keeps its figures; the app shows the live balance.

### Payment and Receipt

- One Payment may cover several Invoices of one Customer and Deposits on that Customer's accepted Quotations. The app fills ticked Invoices oldest first; amounts can be changed. Part-payment is allowed.
- One Payment gives one Receipt, listing each Invoice, Job, amount applied and balance left. "Separate receipts", chosen before saving, records one Payment and Receipt per Invoice instead.
- A Receipt is issued automatically on saving a Payment, after a confirmation screen. No Draft Receipts. Its figures are frozen.
- A Deposit is applied automatically when an Invoice is issued from its Quotation, up to the Invoice total; the user may reduce it and the rest waits for the next Invoice.
- Overpayment, after confirmation, becomes Credit. Credit is suggested, applied only when the user agrees.
- Applying a Deposit or Credit issues an automatic Receipt headed "Deposit applied" or "Credit applied", naming the original Receipt and stating that no new money was received. (review) This holds whenever Credit is applied, not only at issue. These Receipts are kept apart from money Receipts in every list and total and have no payment method.
- An Invoice with nothing paid or applied gets no Receipt.

### Refund, Write-off and Cancelled

- A Refund returns unused Deposit or Credit, up to what is held: amount, date, method, reason, locked Document REF-0001.
- A Write-off closes a remainder that will never be paid, with a reason; it can be undone. (review) It is bad debt only: a price change means cancel and replace. A Write-off must be undone before later money is applied to it, and is reversed if its Invoice is Cancelled.
- Cancelling an Invoice needs a reason. Its Payments and money Receipts stay; its "applied" Receipts are Cancelled; money goes back to the Deposit or otherwise to Credit. "Cancel and replace" opens a Draft copy and suggests the released money.
- Cancelling a money Receipt cancels its Payment and reopens the Invoices it was applied to. Cancelling an "applied" Receipt only releases that application. A money Receipt cannot be Cancelled while its Deposit or Credit has been used or refunded; the app lists those uses to undo first. A Refund can be Cancelled too.
- Corrections are entries with their own real date, time and reason. (review) A cancellation counts on the day it is made; it never rewrites an earlier day. Cancelled PDFs show CANCELLED.

### Job

Open, Done or Dropped, set by hand; controls no Document. Closing with money owing or an unused Deposit warns and offers to move that Deposit to Credit.

### Rules that must always hold

1. Net money received = valid Payments - valid Refunds = money applied to active Invoices + unused Deposits + Credit.
2. Balance owed = active Issued Invoices - money applied - Write-offs. Quotations are never debt.
3. Deposits and Credit are money the Business owes the Customer, shown separately, never silently set off against debt, never counted as earned.
4. No entry is zero or negative. Nothing applies beyond a balance or twice.
5. A Payment, its split and its Receipt save together or not at all.
6. "Applied" Receipts, Quotations and Drafts never count as money received.
7. Nothing Issued or recorded is erased.

### Accounting review: limits

- One user records, cancels and refunds, so there is no second-person check. The permanent history is the control.
- Cancelling an Invoice is accepted while the Business is not VAT-registered; before VAT is turned on, credit notes need checking (see Money and VAT rules).
- ZIMRA says records are kept at least six years: https://www.zimra.co.zw/domestic-taxes/corporate/record-keeping-explained . Nothing Issued is deleted, so this holds while backups survive.
- This covers customer money only. The owner then asked for the full accounting cycle to be provided for: see Accounting foundation. It was not reviewed by an accountant.

Added by Money and VAT rules: marking a Job Done records the date work finished.

Added by Accounting foundation: Payment methods, the accounting date of each entry, and the review.
