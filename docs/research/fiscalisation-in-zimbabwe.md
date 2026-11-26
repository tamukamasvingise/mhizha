# Fiscalisation in Zimbabwe

Researched 2026-11-25 for a sole trader not registered for VAT. Not legal advice. "Read" means the text itself was read; "secondary" means somebody else's summary; "inference" means our reasoning.

## Short answer

**Must the Business fiscalise now? Probably not, on the statute we read, but ZIMRA says yes.** This assumes the Business (a sole trader) is neither registered nor *required* to be registered for VAT. Sections 80DD and 90 of the Income Tax Act let the Minister make rules by regulations; they do not themselves order anyone to fiscalise. The only regulations we found that use them, SI 88 of 2026, cover fuel operators. We found no general regulations for non-VAT traders, but our search of Statutory Instruments was incomplete, so this is not proof that none exist. Get a written answer from ZIMRA before relying on either view.

**Can a free phone app that works offline do it later? Technically yes for issuing, but not for ever without a connection.** ZIMRA's API is a free public download and permits queued receipts. Registration, sending and normal day closing need the internet. The app would need ZIMRA testing and approval, a device ID and certificate, signatures and strict numbering. ZIMRA also has a free Android POS. We found no statement on whether ZIMRA would approve a self-built offline app for a non-VAT sole trader.

**Version 1** does not fiscalise. Keep the records in section 9; add fiscal data later as a separate record attached to a Document.

## Findings

### 1. Legal basis

**Income Tax Act: a power, not a duty by itself.** Read in the [a-tla consolidation, updated to 1 December 2024][ita] (unofficial):

- **80D** lets the Commissioner "establish and maintain a computer system". It imposes no fiscalisation duty.
- **80DD**, "Virtual Tax Management System": for "an electronic platform to enable the electronic recording by taxpayers of transactions that may be liable to tax under this Act", "the Minister shall in regulations made under section ninety prescribe the rules to be followed by taxpayers using the Tax Management System". The note says inserted by Finance Act 1 of 2018 from 14 March 2018.
- **90** is the general regulation power. Penalties in regulations may not exceed "a fine or penalty of level seven" (90(3)).

Inference: 80DD is not limited to VAT operators, so the Minister could reach the Business by regulations. Without regulations that apply, the text quoted is not a duty on it.

A text search of [Finance Act 13 of 2023][fa23], [Finance (No. 2) Act 7 of 2024][fa24] and [Finance Act 7 of 2025][fa25] found no mention of 80D or 80DD. Not every Finance Act was checked.

| Regulations | Who | What we read |
|---|---|---|
| [SI 88 of 2026][si88], Income Tax (Fiscalised Recording of Fuel Transactions) | "all Fuel Operators and Approved Suppliers and Developers"; a Fuel Operator is authorised under the Petroleum Act | Read in part. Made "in terms of section 90 as read with section 80DD". Gazetted 15 May 2026; transmission within six months (s 7), extendable by notice (s 28) |
| SI 104 of 2010, with SI 148 and SI 153 of 2016 | VAT registered operators, [according to ZIMRA][fe] | **Not read.** The only copy found was on zimlii, which refused the automated fetch |

SI 88 shows the income tax power being used for one sector. ZIMRA's "all taxpayers" page names no such regulations for others. A search summary mentioned general "Fiscalisation Regulations, 2026"; we traced that to SI 88's words "the Zimbabwe Revenue Authority's Fiscalisation Data Management System", so it was a misreading.

The [Veritas SI list][sil] (15 index pages, back from SI 159 of 2026) shows no other income tax fiscalisation instrument in its 2025 and 2026 titles. It has gaps, so this is weak evidence.

**VAT Act: registered *or required to be registered*.**

- "Registered operator" means "any person who is or is required to be registered under this Act" ([VAT Act, a-tla consolidation to 1 December 2024][vat], s 2, read). Not registering is no defence for somebody who should.
- [ZIMRA][mech] gives the threshold: taxable supplies that "exceed or are likely to reach US$25,000.00 or ZiG equivalent" in 12 months, from 1 January 2024.
- 68CC (read) gives a similar "Virtual Fiscalisation System" power, by regulations under section 78; inserted by Act 10 of 2022.
- [Act 7 of 2025][fa25] (read) adds to the VAT Act a "fiscal device" definition that includes software compatible with FDMS (ZIMRA's Fiscalisation Data Management System) and "approved by the Commissioner".

**The opposing claims.**

- ZIMRA: "All taxpayers are required to fiscalise in terms of Section 90 ... as read with Section 80D and Section 80DD ..., which grants the Minister the authority to mandate fiscalisation through issued regulations. This obligation also applies to taxpayers with an annual turnover below the VAT registration threshold" ([Fiscalisation Explained][fe], read). It gives no SI, start date or penalty for them.
- [TotalTally][tt] (vendor, secondary): "If you are not VAT-registered, you do not".
- ZIMRA notices [101/2024][pn101], [22/2025][pn22], [30/2025][pn30], [63/2025][pn63] and [37/2026][pn37] (read) are addressed to VAT operators. None sets out a duty for non-VAT sole traders.

### 2. Start dates

- Non-VAT traders generally: none found.
- 31 May 2025, sometimes reported as covering traders below the threshold, was in fact the TaRMS/FDMS integration date for "all VAT Registered Operators" ([PN 22/2025][pn22]). [PN 63/2025][pn63] later set 1 December 2025.
- The 2025 budget proposed virtual fiscalisation below US$25,000 in the first quarter of 2025 ([Lucent][luc25], secondary). We found nothing in Act 7 of 2024, and no regulations, carrying it out.
- The 2027 budget was presented on 19 November 2026 ([Herald][her], secondary). A [departmental draft Finance Bill][fb27] on Veritas, with clauses from 1 January 2027, does not mention fiscalisation or 80DD (text searched). [Lucent][luc27] (secondary) reports a proposed US$500,000 surcharge on VAT operators who fail to fiscalise and traders over the threshold who do not register. We could not get the Budget Statement. Proposals are not law.

### 3. Penalties

- VAT Act 63A and the civil penalty schedule ([Act 13 of 2023][fa23], read) apply the issue and install rules to persons "registered or required to be registered". Failure to install: fixed US$1,000 (suspended if fixed within 96 hours) plus US$25 a day, up to 90 days. Failure to issue, 63A(2)(a): fine up to level 7, up to six months' prison, or both.
- [PN 101/2024][pn101], to VAT operators: US$1,000 for failure to issue; US$25 per POS per day (max 90 days) for not interfacing; US$1,000 plus that daily penalty for not acquiring and using a device; US$1,000 per POS or three times the tax, whichever is higher, for tampering.
- An undated [ZIMRA page][pen] still shows up to 181 days.
- Non-VAT traders: no penalty found. SI 88's penalties are for Fuel Operators.
- Separate and already binding: Income Tax Act 37B requires invoices and books to be kept for six years from the last entry (read).

**Effect on customers.** Income Tax Act 15(2a) (read, 2024 consolidation) bars a *tax invoice for goods or services subject to VAT* as proof of expenditure unless it is a fiscal tax invoice from a registered operator. How this treats an ordinary invoice from a non-VAT trader is unclear. [Lucent][luc16] (secondary) says ZIMRA disallows such purchases, so business customers may ask for a fiscal invoice anyway. [PN 63/2025][pn63] ties tax clearance to fiscalisation for taxpayers "registered for VAT".

### 4. Free API and mobile point of sale

- ZIMRA says the API is "free of charge" and that small traders can use a "Mobile Point of Sale" ([Fiscalisation Explained][fe]).
- The [FAQ][faq] says SMEs can download the free ZIMRA POS for "Android or Windows". [Google Play][play] shows version 1.06, updated 14 March 2026, 5,000+ downloads. Nothing found on its offline behaviour or non-VAT users. Using it beside our app means entering sales twice (inference).
- The API document is [Fiscal Device Gateway API v7.2][api] (undated, relevant parts read). Sections 5 to 8 come from it unless another source is linked.
- It supports a taxpayer with no VAT number: `vatNumber` is omitted and VAT above 0% is refused (RCPT021). That shows technical support, not a legal duty.

### 5. Registration and certification

1. ZIMRA's [onboarding steps][onb], written for VAT operators: download, develop, test, close a day without errors, submit a sample invoice and credit/debit note, get approval, register live.
2. The taxpayer gets a device ID and an 8-character activation key from the portal.
3. The app makes a key pair and certificate request (ECC P-256 preferred, RSA 2048 accepted). FDMS returns a certificate for mutual TLS and receipt signing. It expires; renewing a month early is recommended.
4. Each request carries a device model name and version "as registered in ZIMRA". Blacklisted or unregistered models fail. Whether each app release needs approval is not stated.
5. Test: `https://fdmsapitest.zimra.co.zw`. Live: `https://fdmsapi.zimra.co.zw`. [PN 37/2026][pn37] lists regional addresses for approval of server-to-server virtual devices, for VAT taxpayers.

A virtual solution "can be developed in-house or through engaging third party" ([ZIMRA][fe]). We found no approval fee, and no statement that there is none.

### 6. Offline, fiscal days and numbering

| Topic | Online mode | Offline mode |
|---|---|---|
| Who chooses | Only a ZIMRA officer can change it | Same |
| Open day | Can be done without internet; sent late, before receipts | On device; sent by file later |
| Issue | Can be queued; sent one by one in order once connected | Stored; sent as JSON files up to 3 MB, one day per file |
| Close day | **Internet required**; all receipts sent first | On device; file sent by API or uploaded on the portal |

- A day must be open before issuing. ZIMRA sets its maximum length (`taxPayerDayMaxHrs`); the app must warn beforehand and block issue afterwards. The value for the Business is unknown.
- Inference: in Online mode a phone offline past that limit must stop issuing, because it cannot close the day and open another. Longer offline use needs ZIMRA to set Offline mode; its conditions are not stated.
- The document contradicts itself: section 2.4 allows files during an open day; `submitFile` says closed days only. Test first.
- `receiptGlobalNo`: plus one per fiscal document per device, no gaps, with an optional reset to 1 at the first receipt of a day. `receiptCounter`: restarts each day. `fiscalDayNo`: plus one. `invoiceNo`: up to 50 characters, **unique for the taxpayer**.
- Each signature includes the previous receipt's hash, except the first of a day. Receipt times are local and must increase. "Red" or "Grey" errors (gaps, wrong totals and similar) stop automatic day closing.
- Counters by tax, currency and payment type are sent at close; the standard end-of-day print is the Z report.
- The app must not be uninstalled with unsent receipts. [PN 101/2024][pn101] tells VAT operators to keep the system "connected at all times".
- Inference: each phone is its own device, with its own key and chain. Restoring an old backup or cloning a phone could break the chain, so fiscal state cannot be treated as ordinary backup data.

### 7. Fields and QR

A fiscal document is a `FiscalInvoice`, `CreditNote` or `DebitNote`, with currency, numbers, local date-time, tax-inclusive flag, lines, tax totals, payments, total and signature. Buyer, notes (on invoices) and user are optional.

- **Line:** sale or discount, number, name (up to 200 characters), quantity above 0, optional unit price, total, tax ID. If a price is sent, total = price x quantity. An invoice discount line has a negative price. HS code is mandatory only for VAT payers; others may send 4 or 8 digits.
- **Totals** must match lines, tax totals *and* payments. Payment types: Cash, Card, MobileWallet, Coupon, Credit, BankTransfer, Other. Inference: an unpaid Invoice would use Credit, which the API does not define.
- **Tax:** every line needs a tax ID from ZIMRA's `getConfig`, even with no VAT. The right one for the Business is unknown.
- **Buyer:** if sent, name and TIN are required. Any address needs province, city, street and house number. [PN 30/2025][pn30] tells VAT operators to put a buyer with no TIN elsewhere on the receipt.
- **Printed** as a 48-column receipt or A4: taxpayer name, TIN, branch address, numbers, device ID and serial, date-time, lines, currency, total, payments, QR or its text code, and validation URL. Non-VAT taxpayers omit the tax block.
- **QR:** ZIMRA URL + `/` + device ID (10 digits) + date `ddMMyyyy` + global number (10 digits) + first 16 characters of the MD5 of the device signature. It can be made offline; it cannot validate at ZIMRA until sent (inference). The server `receiptID` and FDMS signature arrive later and should be stored.

### 8. Credit notes and cancellation

The listed API operations include no receipt cancel or delete. Corrections are credit or debit notes:

- Names the original by server receipt ID, or device ID + global number + fiscal day number. A reason is mandatory.
- The original must exist in FDMS and be at most 12 months older. Same currency; no new tax types.
- Notes may not take the original below zero.

Inferences: an Invoice issued before fiscalisation cannot be credited in FDMS. Our "Cancelled" would also need a fiscal credit note. Our Credit (money held) is not a fiscal credit note. Our Receipt is not clearly an FDMS "receipt" (invoice, credit or debit note); sending both Invoice and Receipt as sales could double count.

### 9. What a version 1 record must hold

Design inferences from the API, not legal requirements:

1. A permanent internal ID, separate from the printed number. Printed numbers unique across all the Business's Documents, at most 50 characters, never reused.
2. Type, currency code, and full local issue date **and time** plus time zone. The issuer details as issued.
3. A locked copy of Customer, Site and billing details. Room for optional TIN, VAT number, legal and trade names, phone, email and structured address.
4. Lines in order with stable IDs: description, quantity, unit price, discount, total. Exact decimals or minor units, never floating point; fixed rounding rules.
5. A tax treatment that can be "not VAT registered". Do not treat 0%, exempt and no VAT as the same.
6. Payments with date-time, amount, currency, specific method and reference, and exact links to where each Payment, Deposit or Credit was Applied. Keep "unpaid" distinct.
7. Cancellations and replacements linked to the original, with date-time and reason. Refunds linked to the money returned. Never overwrite or delete an Issued Document.
8. No ZIMRA-style QR, fiscal number or "Fiscal Tax Invoice" wording on version 1 Documents.

Later, add an optional fiscal record per Invoice or note: device, day, numbers, hash, signature, QR data, send state, server ID, errors. Start from a cut-over date; mark older Documents "not fiscalised". Do not back-send them unless ZIMRA instructs it.

## Unknowns

1. Whether unlocated regulations or a notice bind non-VAT traders. **Ask ZIMRA in writing for the SI number, section, start date and penalty.** SI 104 of 2010 and its amendments remain unread.
2. Whether the Business's taxable supplies exceed, or are likely to reach, US$25,000 in 12 months. Not checked; it would change the answer.
3. Other changes since the December 2024 consolidations; the official 2027 Budget Statement and final Bill.
4. Whether ZIMRA will register a non-VAT sole trader, approve a self-built Android app, allow Offline mode, or charge a fee.
5. Fiscal day length, certificate life, approval of app updates, and phone replacement.
6. The tax ID and the treatment of Deposits, part payments, credit sales and later Receipts.
7. Whether business customers can claim a non-fiscal invoice from a non-VAT trader.
8. Offline and non-VAT support in ZIMRA POS.

**Confidence:** high that 80D, 80DD and 90 as quoted are enabling powers and SI 88 is fuel only; high on the v7.2 rules as documented, though untested; medium that the Business has no duty now, conditional on VAT status; low on ZIMRA's enforcement and future dates.

[ita]: https://a-tla.org/zimbabwe/income-tax-act-chapter-2306
[vat]: https://a-tla.org/sites/default/files/2026-05/Zimbabwe%20-%20Valued%20Added%20Tax%20Act%2C%20Chapter%2023-12%2C%20updated%20Dec%201st%202024%20C.pdf
[fa23]: https://www.veritaszim.net/sites/veritas_d/files/Finance%20Act%202024%20Act%2013%20of%202023.pdf
[fa24]: <https://www.veritaszim.net/sites/veritas_d/files/Finance%20(No.%202)%20Act,%20Act%20No.%207%20of%202024.pdf>
[fa25]: https://www.veritaszim.net/sites/veritas_d/files/Finance%20Act,%20Act%20No.%207%20of%202025.pdf
[fb27]: https://www.veritaszim.net/node/8153
[si88]: <https://www.veritaszim.net/sites/veritas_d/files/SI%202026-088%20Income%20Tax%20(Fiscalised%20Recording%20of%20Fuel%20Transactions)%20Regulations,%202026.pdf>
[sil]: https://www.veritaszim.net/statutoryinst
[fe]: https://www.zimra.co.zw/domestic-taxes/corporate/fiscalisation-explained
[mech]: https://www.zimra.co.zw/domestic-taxes/vat/mechanics-of-vat
[pen]: https://www.zimra.co.zw/news/2183:offences-and-penalties-in-fiscalisation
[onb]: https://zimra.co.zw/news/2307-compliance-with-the-zimra-fiscalisation-data-management-system-fdms
[faq]: https://www.zimra.co.zw/frequently-asked-questions?start=30
[api]: https://www.zimra.co.zw/downloads/9-domestic-taxes?download=3807%3Afiscalisation-api-documentation
[pn101]: https://www.zimra.co.zw/public-notices?download=4179:public-notice-101-of-2024-virtual-fiscalisation-compliance
[pn22]: https://www.zimra.co.zw/public-notices?download=4308:public-notice-22-of-2025-on-extension-of-deadline-to-implement-tarms-fdms-integration
[pn30]: https://www.zimra.co.zw/public-notices?download=4340:public-notice-30-of-2025-buyer-details-on-fdms-fiscal-tax-invoice
[pn63]: https://www.zimra.co.zw/public-notices?download=4410:public-notice-63-of-2025-tarms-fdms-integration
[pn37]: https://www.zimra.co.zw/public-notices?download=4522:public-notice-37-of-2026-new-fdms-support-emails-per-region
[play]: https://play.google.com/store/apps/details?id=zw.co.zimra.ZIMRAPOS&hl=en
[tt]: https://www.totaltally.co.zw/zimra-fiscalisation
[luc25]: https://lucent.co.zw/tax/taking-a-quick-dive-into-key-proposed-changes-in-2025-finance-bill/
[luc16]: https://lucent.co.zw/tax/the-cost-of-non-compliance-section-161-fiscalisation-and-corporate-tax-burden-in-zimbabwe/
[luc27]: https://lucent.co.zw/tax/analysis-of-zimbabwean-2027-finance-bill-and-budget-tax-proposals/
[her]: https://www.heraldonline.co.zw/imtt-rates-to-be-reduced/
