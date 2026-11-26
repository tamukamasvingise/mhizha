# Money and VAT rules

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 06

## Question

How are line amounts, discounts, rounding, totals, balances and "the sum of" words calculated and stored? How does the VAT setting affect new and already Issued Documents, so it can be turned on later safely?

From Document lifecycle: before VAT can be turned on, check the current VAT Act: whether VAT falls due on a Deposit when it is received (sources say the earlier of invoice or payment), and whether Issued Invoices must be corrected by credit note instead of cancellation.

## Answer

Decided with the owner on 2026-11-25. Not reviewed by an accountant or tax adviser. Law: [VAT in Zimbabwe](21-vat-in-zimbabwe.md), [Fiscalisation in Zimbabwe](20-fiscalisation-in-zimbabwe.md).

### Money (standard practice, put to the owner without objection)

- USD, stored as whole cents. Quantities have up to 3 decimals. No floating-point sums.
- Line amount = quantity x unit price, rounded to the nearest cent, half a cent up. Lines add up exactly to the Subtotal. Zero-price lines are allowed, negative ones are not.
- Subtotal - Discount + VAT = Total. An Issued Document has a Total above zero. VAT is worked out once on the Subtotal after Discount, not per line (recheck against the law with the VAT update).
- Totals stay exact; no rounding to whole dollars.
- Issued Documents store their lines, Discount, totals, tax status and any rate and VAT. Balances are always worked out from entries.
- "The sum of" is written by the app: "One hundred and fifty US dollars and twenty-five cents only".

### Discount

- One per Quotation or Invoice, an amount or a percentage (rounded to the cent), never above the Subtotal. None on single lines. Shown on both Documents, only when used; the Invoice design gains the row.
- An Invoice from a Quotation carries its Discount over and never takes it twice. An Invoice with no Quotation can have its own.
- Several Invoices from one Quotation each take the share Quotation Discount x Invoice Subtotal / Quotation Subtotal; the last takes the leftover cents. Editable on the Draft. Shares filled in by the app never add up to more than the Quotation's Discount.

### VAT in version 1

- No VAT button and no registration fields. Nothing charges VAT. This replaces the earlier "VAT setting, off by default".
- The VAT field on the Invoice design stays and is left blank, not 0.00. No extra VAT wording is printed. The Quotation design stays without a VAT row until VAT applies.
- Each Issued Document records the tax status "not registered", kept separate from 0% and exempt.

### VAT later, in an update

- Business details gain the VAT number and registration date. The app then decides and fills VAT in by itself; the user does not choose it. Rates are stored with their dates (15.5% from 1 January 2026).
- The time of supply decides, not the Invoice date alone: normally the earliest of Invoice issued, payment received, goods handed over, work done. An unapplied Deposit is not yet payment.
- Invoiced and finished before registration, paid later: no VAT. Finished before, invoiced later: no VAT. Deposit held with work and Invoice later: VAT on the full price. Everything later: VAT.
- The one exception: unclear Jobs crossing the date (work half done, or invoiced before and done later) ask the user to confirm the treatment, on advice, with a recorded reason.
- Issued Documents never change. Drafts recalculate. Saved prices are before VAT. Open Quotations without VAT need a Revision before invoicing. After registration, taxed Invoices are corrected by credit note, not cancelled.
- Before that update, check with ZIMRA or an adviser: the current Act, the unclear Jobs, adding VAT to accepted prices, rounding, credit notes, and Deposits. Fiscal Documents are required then, so a plain PDF is not enough.

The owner did not want a "VAT may be added" term printed. Consequence: an accepted price may have to absorb VAT (US$1,000 becomes about US$865.80 after 15.5%).

### Added to version 1

- Marking a Job Done asks for the date work finished: today by default, earlier allowed, never later than today.
- The app adds up the last 12 months of sales and warns once on reaching US$20,000 and once on exceeding US$25,000, with "speak to ZIMRA or an accountant". A sale counts at the earlier of Invoice issued or work finished; Deposits, Quotations and Cancelled Invoices do not count. It cannot see expected future sales, so it never says the Business need not register.

### Fiscalisation

Not in version 1; provided for. Records keep: permanent IDs; unique printed numbers never reused; date, time and time zone; locked customer and business details with room for tax numbers and a structured address; exact lines and totals; tax status; Payment methods and Applied links; cancellation reasons. Fiscal data can be attached later as separate records.

Unconfirmed: ZIMRA's page says all taxpayers must fiscalise; no regulation binding a trader not registered for VAT was found. If a Business is required to register for VAT, the answer changes. A Business should ask ZIMRA in writing.
