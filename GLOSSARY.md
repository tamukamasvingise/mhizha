# Mhizha

The language of the app a Business uses to keep customers and issue quotations, invoices and receipts.

## People and work

**Business**: The trade that keeps its records in the app, whose name and logo appear on its Documents.
_Avoid_: Client, company, shop

**User**: The person using the app on the phone, working for a Business.
_Avoid_: Owner, customer

**Customer**: A person or organisation the Business quotes or bills. Has one or more Sites.
_Avoid_: Client, contact

**Site**: A place, belonging to one Customer, where work is done.
_Avoid_: Location, project

**Job**: One piece of work for a Customer at one Site.
_Avoid_: Project, order

## Documents and money

**Document**: A Quotation, Invoice, Receipt or Refund.

**Quotation**: A priced offer for a Job. Changed after sending by making a new Revision.
_Avoid_: Quote, estimate

**Revision**: A numbered later version of a Quotation (Rev 2, Rev 3).

**Invoice**: A request for payment for a Job, with or without a Quotation behind it.
_Avoid_: Bill

**Payment**: Money received from a Customer, for one or more Invoices or Deposits.

**Deposit**: Money paid against an accepted Quotation and not yet Applied to an Invoice.

**Credit**: Money the Business holds for a Customer that is tied to no Quotation or Invoice.
_Avoid_: Credit note

**Applied**: Said of a Payment, Deposit or Credit used to reduce an Invoice.

**Receipt**: The Document that acknowledges one Payment, or a Deposit or Credit being Applied with no new money received.

**Refund**: Money returned to a Customer from an unused Deposit or Credit, and the Document that records it.

**Write-off**: The remainder of an Invoice accepted as never going to be paid.
_Avoid_: Discount

**Draft**: A Document not yet Issued; freely editable.

**Issued**: Final. An Issued Document is locked.

**Superseded**: Said of a Quotation version replaced by a later Revision.

**Expired**: Said of an Issued Quotation past its valid-until date.

**Cancelled**: An Issued Document withdrawn because of a mistake. Stays visible; any replacement gets a new number.
_Avoid_: Deleted, void

**Discount**: An agreed reduction of a Quotation or Invoice, taken before VAT.
_Avoid_: Write-off

**Price list**: The saved items that fill in Document lines. Not stock.
_Avoid_: Inventory, catalogue

## Accounting

**Accounting period**: The stretch of time, chosen by the user, at whose end the records are reviewed.

**Start date**: The day the Business began keeping its records in the app.

**Opening balance**: An amount a Customer owed the Business, or the Business held for a Customer, on the Start date, taken from earlier records.
_Avoid_: Old invoice, brought forward, carried forward, before the app

**Review**: The plain-language list of possible mistakes and unfinished matters the user answers, offered at the end of each Accounting period.
_Avoid_: Adjustment, audit, closing

## Keeping records safe

**Backup**: One password-locked file holding all of a Business's records, made on the phone and saved by the user somewhere off the phone.
_Avoid_: Export, sync

**Restore**: Replacing the records on a phone with those in a Backup.
