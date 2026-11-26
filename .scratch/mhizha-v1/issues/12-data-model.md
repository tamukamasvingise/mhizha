# Data model

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 04, 06, 07, 10, 18, 19

## Question

What tables, unique IDs, snapshots of customer and business details on Issued Documents, PDF storage and database-upgrade rules does the app need so that syncing can be added later?

From Money and VAT rules: hold the fiscalisation and VAT provisions listed there, including time zone, tax status, tax numbers and structured address.

From Accounting foundation: hold accounts, immutable balanced entries with accounting date and recorded time, accounting periods and their settings history, review items and answers, and payment methods.

From Opening balances: hold the Start date, Opening balance items (old invoice number, date, amount, note, optional Job, cancellation), their applications, and the monthly sales totals before the Start date.

From Signing and delivery: before upgrading its database on first open after an update, the app keeps a copy on the phone and returns to it if the upgrade fails.

## Answer

Decided with the owner on 2026-11-26. Items marked (standard practice) follow the principles of accounts or of database design and were stated, not asked. Not reviewed by an accountant.

### Rules for every record

- **Permanent ID:** every record gets one, made on the phone: a time-ordered random ID (UUID v7). Printed numbers such as INV-0001 are separate fields. Each install has its own install ID, and every record names the install that made it.
- **Change tracking:** every record has its created time, last-changed time and a change counter.
- **Deleting:** only Drafts, Price list items and hidden settings can be deleted. Deleting leaves a "deleted" marker and never erases the record.
- **Times and dates:** recorded times are saved in world time (UTC) with the phone's time zone (Africa/Harare). Accounting dates, Date received and the date work finished are plain dates.
- **Store facts, work out status:** what happened is stored (issued, accepted on a date, paid, cancelled with a reason). Unpaid, Overdue, Expired, Closed, balances and amounts owed are always worked out, never saved.
- **Money:** amounts are whole cents and quantities are thousandths, both stored as whole numbers. The database refuses zero or negative amounts wherever Document lifecycle forbids them.
- **Saving:** each action that touches several records saves as one unit, or not at all. The database refuses links to records that don't exist.

### Documents

- **Frozen copy:** an Issued Document keeps a frozen copy of the Business, Customer, Site and Job details it printed, inside its own record. Live Customers, Sites and Jobs are for new work only.
- **Lines:** a line copies the name, unit, quantity and price from the Price list. It keeps a link to the Price list item only for reports.
- **PDF:** the PDF is made once, at issue, and kept as a file that goes into every Backup. A Cancelled Document gets a CANCELLED copy and the original file is kept. Drafts are rebuilt each time they are previewed.
- **Numbering:** each Document type has one counter (prefix, starting number, last number issued). The counter moves up in the same save that issues the Document.

### Files

- **Images and PDFs:** logos, signatures and PDFs are files, each with its own ID and a checksum, and are never overwritten. A new logo is a new file; a frozen copy points to the logo it used. All files go into the Backup.
- **Backup password:** kept in the phone's secure storage, not in the database, so a Backup file never holds it. (standard practice)

### Settings over time

Business details, the Accounting period choice and Payment methods are each saved with the date they took effect, and old versions are kept. The Review and the period adjustments use the settings that applied at the time.

### Ledger (standard practice, double entry)

- **Journal entries:** each event the app records becomes one journal entry. The entry holds its accounting date, recorded time, reason, and the Document, Payment or adjustment it came from.
- **Lines:** an entry has two or more lines. Each line names an account, the Customer where there is one, and a debit or a credit in cents. Debits must equal credits, or the entry is refused.
- **Every movement of money is a journal entry:**
  - Invoices
  - Payments
  - Deposits and Credit applied
  - Write-offs
  - Refunds
  - Opening balances, and payments against them
  - period adjustments
- **Customer ledgers:** each Customer has a subsidiary ledger. Money received or applied is matched to what it settles: an Invoice, an Opening balance item, or a Quotation (for a Deposit). Each of these then shows what is still open. Together, the Customer ledgers always equal the Customers owe, Deposits held and Credit held accounts.
- **Corrections:** nothing is changed or deleted. A mistake is corrected with a reversing entry dated the day of the correction, followed by the correct entry.
- **Accounts:** fixed records with permanent codes. Later accounts are only ever added.
- **Period-end adjustments:** ordinary journal entries, linked to their Accounting period and marked as adjustments.

### Database upgrades

- **Upgrade steps:** the database carries a version number and is upgraded by numbered steps that only go forward and never delete the user's data.
- **Safety copy:** the app copies the database before upgrading and returns to the copy if a step fails (Signing and delivery).
- **Backups:** an older Backup is restored by running the same steps; a newer one is refused (Backup and restore).

### Tables

Every table also has an ID, install ID, created time, last-changed time and change counter, plus a deleted marker where deleting is allowed.

| Area | Table | Main fields |
|---|---|---|
| Setup | install | install ID, first opened, app version |
| | business_details | effective from; name, phone, email, structured address (lines, suburb, city, province, country), tax number, later VAT number and registration date; logo file, signature file; time zone |
| | accounting_period_setting | effective from, how often (monthly, 3-monthly, yearly), month the year starts |
| | setup | Start date, app lock on/off, backup reminder state |
| | pre_start_sales | month, sales total (the 12 months before the Start date) |
| | payment_method | code, name, Other description allowed, money account, effective from, hidden from |
| | document_counter | Document type, prefix, starting number, last number issued, locked |
| | file | kind (logo, signature, PDF), path, checksum, size |
| People and work | customer | name, person or organisation, phones, WhatsApp, email, structured address, tax number, archived |
| | customer_note | Customer, text, date |
| | follow_up | Customer, due date, done |
| | site | Customer, name, structured address, archived |
| | job | Customer, Site, title, archived |
| | job_event | Job, opened / done / dropped / reopened, date work finished |
| | price_list_item | name, unit, unit price |
| Documents | document | type (QUO, INV, REC, REF), Customer, Job, number (none on a Draft), Revision and the Quotation it revises, the Quotation an Invoice came from, issued time and time zone, issue date, valid until, due date, tax status, VAT rate and amount, subtotal, Discount (amount or %, value, cents), total, sum in words, frozen copy, PDF file |
| | document_line | Document, position, Price list item, description, unit, quantity, unit price, amount |
| | receipt_line | Receipt, Invoice or Opening balance item, Job, amount applied, balance left (frozen) |
| | document_event | Document, accepted / declined / acceptance undone / cancelled, date, reason |
| Money | payment | Customer, Date received, Payment method, Other description, amount, separate receipts |
| | refund | Refund Document, from Deposit or Credit, amount, date, Payment method, reason |
| | write_off | Invoice, amount, date, reason |
| | opening_balance_item | Customer, owed or Credit held, old invoice number, old date, amount, note, Job, Quotation attached |
| | allocation | journal entry, from (Payment, Deposit, Credit, Opening balance Credit), to (Invoice, Opening balance item, Quotation as Deposit, Credit), amount, the allocation it reverses |
| Ledger | account | permanent code, name, kind (asset, liability, equity, income, expense), hidden, kept per Customer |
| | journal_entry | accounting date, recorded time and time zone, source, reason, the entry it reverses, Accounting period, adjustment marker |
| | journal_line | journal entry, account, Customer, debit, credit (exactly one above zero) |
| | accounting_period | start date, end date, review offered, review finished |
| | review_item | Accounting period, kind, what it is about, what was found, answer, answer date, remind after |
| Keeping records safe | backup_log | made at, file name, size, record counts, database version, change counter at the time |
| | restore_log | restored at, Backup made at, last numbers entered per type, numbers found missing |
| | upgrade_log | from version, to version, started, finished, result |

Fiscal records are not in version 1. They attach later as their own tables pointing at Documents (Money and VAT rules).

Added by Document PDF prototype (2026-11-26): business_details gains trading-as line (optional), what we do line, bank name, account name, account number, branch, mobile money details, brand colour, font, watermark on/off; the Quotation gains Deposit asked and lead time; site gains contact person; the Invoice gains the customer's Order No.

Added by Install and update proof (2026-11-27): the safety copy before an upgrade is made with SQLite's VACUUM INTO and opened to check it before any step runs; returning to it uses the same method.
