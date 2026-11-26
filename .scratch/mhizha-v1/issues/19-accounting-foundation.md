# Accounting foundation

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 07

## Question

The owner wants the full accounting cycle provided for: version 1 may start small, but must not need its records rebuilt later. The cycle is: source document, journal, ledger, trial balance, adjustments, financial statements, closing, opening balances of the next period.

Settle:

- Which parts version 1 does, which it only records for, and what comes later (expenses, supplier bills, bank and cash matching, owner's money in and out, assets, reports).
- Whether every money event posts a balanced double entry from day one, and the exact entry for each: Invoice, Payment, Deposit and Credit received and applied, Refund, Write-off, and every cancellation.
- The starting list of accounts, and which the user sees. The user is not an accountant, so posting should be automatic.
- When income counts: cash or accrual, and on Invoice issue or Job completion.
- Which date an entry belongs to when Date received differs from the recorded date, and how closed periods stay closed.
- Financial year, and how opening balances enter (see Opening balances).
- What an accountant can be given: export format and contents.

From Money and VAT rules: the date work finished is recorded on a Job and may decide when income counts; leave room for output VAT and input VAT accounts.

## Answer

Decided with the owner on 2026-11-25. Not reviewed by an accountant. Version 1 treats the Business as an individual contractor, working alone or with a managed team, not a company. Items marked (detail) are mechanics filled in when writing this up.

### Scope of version 1

- Customer money only: Invoices, Payments, Deposits, Credit, Refunds, Write-offs. Later: expenses, supplier bills, owner's money, assets, bank matching, closing, financial statements.
- Never shows profit or "cash in hand": spending is unknown. Shows money received, invoiced sales, money owed, and Deposits and Credit held, for any date range.
- No accountant export. The records allow one later.
- When expenses arrive, the user enters the real money balances; the difference goes to a clearing account.

### Posting

- Balanced entries are stored from day one, in the same save as their Document, by the app alone. The user never sees debits, credits or account names.
- Entries are never edited or deleted. Corrections are reversing entries.
- The app checks that debits equal credits and that the ledger agrees with Customer balances. A failed check warns and changes nothing.
- Quotations, Drafts and Jobs post nothing.

| Event | Debit | Credit |
|---|---|---|
| Invoice issued, after Discount | Customers owe | Sales |
| Payment | Money account | Customers owe, Deposits held or Credit held |
| Deposit or Credit applied | Deposits or Credit held | Customers owe |
| Deposit moved to Credit | Deposits held | Credit held |
| Refund | Deposits or Credit held | Money account |
| Write-off | Bad debts | Customers owe |
| Cancellation or undo | Exact reverse of the original | |

### Accounts

- Customers owe, money accounts, Deposits held, Credit held, Opening balances, Owner's equity, Sales, Bad debts, plus the hidden Unearned income and Unbilled work. Balances are kept per Customer where they belong to one.
- Later accounts (output and input VAT, supplier bills, expenses, drawings, assets, loans, tax) are added without changing old records.
- Payment methods: Cash, Bank transfer, Card (swipe), EcoCash, InnBucks, Other (with a short description). Each has its own money account, except Bank transfer and Card, which share Bank. Unused methods can be hidden. A Refund uses the same list.
- A Payment records the full amount paid. Provider charges come with expenses.

### Dates

- Each entry has an accounting date and the real time recorded.
- A Payment belongs to its Date received. If that is before the Invoice date, the money counts as held for the Customer until the Invoice date, then applies, without an extra Receipt.
- Cancellations and undos count on the day they are made.
- Version 1 closes nothing. Later rule: a closed period accepts no entries; a late-recorded Payment posts on the first open day and its Receipt keeps the true Date received. Version 1 warns when Date received is in an earlier year, but allows it.

### Accounting period

- At first setup the user chooses how often to review (monthly, every 3 months, yearly) and the month the year starts. Prefilled: monthly, January. Changes take effect from the next period; past periods stay.
- Unchecked: whether an individual's tax year may differ from January to December. Confirm with ZIMRA before any tax feature.

### Income and adjustments

- Sales post when the Invoice is issued. Adjustments are made for each accounting period, not only at year end.
- Owner's decision: keep the mechanism, do not show it. The app makes the adjusting entries by itself in version 1, from the Job dates and review answers, with no screen for them.
- Invoiced but not finished by period end: debit Sales, credit Unearned income. Finished but not invoiced: debit Unbilled work, credit Sales. Both reverse on the first day of the next period.
- (detail) They post, dated the last day of the period, when the review is finished, or at the end of the following period from what is known if it was not. If facts change while the period is open, the entry is reversed and posted again with the same accounting date.
- (detail) Unearned: active Invoices on an unfinished Job, less Write-offs. Unbilled: the Invoice itself if issued by then, otherwise the accepted Quotation after Discount less what was invoiced. With neither, no amount is guessed: no entry, and the Job stays in the review. "No charge" posts nothing.
- Adjustments never change Documents, Customer balances, the sales shown to the user, or the VAT threshold total.
- Work finished in stages is treated as unfinished until the Job is Done. Staged income is a later question for an accountant.

### Review

- A list of plain sentences with action buttons, using only actions already in Document lifecycle. Nothing else changes without a tap.

| Found | Actions |
|---|---|
| Job finished, no Invoice | Make Invoice / No charge / Remind me later |
| Job invoiced, not marked finished | Finished (date) / Still working |
| Open Job, nothing recorded for 60 days | Finished / Still working / Dropped |
| Invoice overdue | Payment received / Call / Never going to pay (Write-off) / Still waiting |
| Deposit held, Job finished or dropped | Use on an Invoice / Keep as Credit / Refund |
| Credit held while money is owed | Apply Credit / Leave |
| Two Payments look the same | Both are real / Cancel one |
| Two Invoices look the same | Both are real / Cancel one |
| Draft never issued | Finish / Delete / Keep |

- Offered once when each period ends ("Your October review is ready: 4 items"), and openable at any time. Can be done in parts or put off; never blocks work.
- Each answer is kept with its date and not asked again in that period. Finishing does not lock the period in version 1; in the later closing update it closes it.
