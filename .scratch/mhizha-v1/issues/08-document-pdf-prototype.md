# Document PDF prototype

Label: wayfinder:prototype
Type: prototype
Status: resolved
Blocked by: 03, 06, 07, 17

## Question

How do the Quotation, Invoice and Receipt PDFs look with real-length content, on one page and several, with VAT off and on, and with signatures?

From Document lifecycle: also cover the Refund, a Receipt covering several Invoices, the "Deposit applied" / "Credit applied" Receipt, and the CANCELLED mark.

From Money and VAT rules: VAT field left blank on the Invoice, no VAT row on the Quotation, no VAT wording; also try the later VAT-filled look. Discount rows on both, only when used.

From Opening balances: a Receipt line can be an Opening balance ("Opening balance (invoice 1234)"), and an applied Receipt can read "Credit applied from opening balance".

From Main screens prototype: every Document is A4, Receipts and Refunds included, so there is one page size for all (owner, 2026-11-26). A Discount given as a percentage shows it in the row: "Discount (10%)", then the amount.

From Product name and open source: one unbranded layout based on the reference designs' layout; each Business uploads its own logo and details. The reference Business's logo, watermark and designs never enter the repo.

## Answer

Decided with the owner on 2026-11-26. Prototype (throwaway, made-up Business and dummy data): branch `prototype/document-pdf`, file `prototypes/document-pdf/document-pdf-prototype.html`. All nine Documents printed to real A4 PDFs in Chromium with nothing cut off.

### Layout (all Documents, A4)

- Letterhead centred: optional trading-as line, logo and Business name, then phones and address. Document title on the left with its number and dates on the right. Customer and Site / Job side by side. Lines table: #, Description, Qty with unit, Unit price, Amount. Totals on the right, under the table. Business signature at the bottom. Footer: the Business's "what we do" line, then the Document number and "Page n of N".
- An optional field left empty is left off the PDF, never printed as a blank line (Order No., Site contact, trading-as line).
- Long Documents: later pages get a short header (Business name, Document number, "continued"); "Continued on the next page" under the table; totals, terms and signature only after the last line.
- The total is written in words under the totals.

### Each Document

- Quotation: Terms (Validity, Deposit asked, Lead time); Discount row only when used, "Discount (10%)" for a percentage; no VAT row in version 1; Revisions show "Revision 2 · replaces Rev 1 of (date)".
- Invoice: Quote ref. and Order No. in the header; Payment details (bank, account name and number, branch, mobile money); VAT row kept and left blank; a Deposit already applied shows as "Deposit applied (REC-…)", then Balance due. The later VAT look (VAT number in the letterhead, VAT 15.5% filled) fits the same layout.
- Receipt: Received from, the sum in words, Being payment for; tick boxes for every Payment method with the one used ticked; the amount in a large USD box; a table of what it paid (Invoice or "Opening balance (invoice 1234)", Job, total, paid now, balance left). Both dates show when Date received differs.
- "Deposit applied" and "Credit applied from opening balance" Receipts: a subtitle, a notice that no new money was received naming the original Receipt or the opening balance, no Payment method, "Applied now" in the table.
- Refund: Paid to, the sum, what it refunds and from which Receipt, the reason, the method ticked.
- Cancelled: a large CANCELLED stamp on every page carrying the date, reason and replacement number. It never adds a page; the original PDF is kept.

### Owner choices

- No customer signature lines on any Document: acceptance is recorded in the app. Only the Business's own line (Prepared by, Authorised, Received by, Paid by), with an optional signature drawn once in Settings.
- Each Business sets its own brand colour during profile setup, next to the logo upload: a premade colour or its own. A colour too pale to read as small text is darkened automatically for text; lines and marks keep the exact colour.
- Each Business chooses its font from Inter (the default), IBM Plex Sans, Manrope and Source Serif 4. All four are SIL Open Font License, built into the app, so they work offline.
- An optional faint logo watermark, off by default.
- The trading-as line is optional, for Businesses that do not use one or are companies.

### Added to the Data model

Business details: trading-as line (optional), "what we do" line, bank name, account name, account number, branch, mobile money details, brand colour, font, watermark on/off, signature file. Quotation: Deposit asked, lead time. Site: contact person. Invoice: customer's Order No.
