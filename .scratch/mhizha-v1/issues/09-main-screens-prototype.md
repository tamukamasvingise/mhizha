# Main screens prototype

Label: wayfinder:prototype
Type: prototype
Status: resolved
Blocked by: 06

## Question

How should the main screens look and flow: home, customer, creating a Quotation, turning it into an Invoice, recording a Payment, settings?

From Money and VAT rules: marking a Job Done asks for the date work finished; show the VAT threshold warning.

From Accounting foundation: design the review list, its notice, the date-range money figures, and the first-setup accounting period step. No debits, credits, account names, profit or cash in hand.

From Opening balances: design the setup steps for Start date, Opening balances and the 12 monthly sales totals, adding Opening balances later from a Customer, and the Opening balance wording given there. Never say "before the app".

From Product name and open source: setup lets the Business upload its logo and enter its details for its Documents.

## Answer

Decided by the owner, 2026-11-26, after three rounds on a clickable prototype. The prototype is kept on the throwaway branch `prototype/main-screens` (`prototypes/main-screens/main-screens-prototype.html`); main keeps only these decisions.

**Shell and layout**

- Four tabs at the bottom: Home, Customers, Documents, Money. Small outline icons with labels; the current tab is marked.
- One New button for a Quotation, Invoice, Payment or Customer.
- Settings is a gear at the top right, beside the Mhizha mark.
- Quotations and Invoices are made step by step, one question per screen: who, which Job, the lines, then check and issue. No feature appears twice.
- Phone only. Tablet and wide-screen layouts are skipped because version 1 runs on one phone (Android 10, 720p baseline).

**Screens**

- Home: "Customers owe you" is the one big figure, with the "Needs you" list under it.
- The VAT threshold warning is a notice on Home until "Got it", then shown only on Money.
- The accounting review is an "Open review" card on Home until finished, never a pop-up.
- The Documents list puts Drafts first, then the newest issued, and filters by Drafts, Quotations, Invoices and Receipts. The same order is used on a Customer.
- First setup order: business details and logo, Document numbers, Start date, Accounting period, Opening balances (can be skipped), sales before the Start date (can be skipped), App lock. Both skippable steps are also reachable later from Settings.

**Discount**

- On the check-and-issue step the Discount is an amount or a percentage, chosen with a US$ | % switch. With %, the amount shows as it is typed ("10% = US$25.80").
- A percentage Discount reads "Discount (10%)" on the totals and the PDF. It carries over to an Invoice made from a Quotation, to Revisions and to a replacement after Cancel.
- A percentage outside 0 to 99.9 is refused: "Enter a percentage from 0 to 99.9."

**Colour**

One orange accent on Life OS's greys, applied the way Life OS and Catalogue apply their green. The owner's suggested navy, green and amber are not used.

- Orange only on the primary button, the current tab (with a pale orange tint), selected items, the mark, step bars and focus.
- Everything else is grey. Red only for errors, overdue amounts and Cancel.
- No warning or success colours: notices are grey cards with bold titles, and "Paid" is words, not colour.
- Light and dark follow the phone; the app has no theme switch.
- Light: page #F6F7F7, surface #FFFFFF, text #18181B, labels #52525B, lines #E4E4E7, tint #F4F4F5, orange #C2410C, selected #FFEDD5 / #9A3412, red #B91C1C.
- Dark: page #0A0A0A, surface #141416, text #F4F4F5, labels #A1A1AA, lines #27272A, tint #1C1C1F, orange #FB923C, selected #431407 / #FED7AA, red #F87171.
- These become the app's `DESIGN-SYSTEM.md` when the app is built.

**Review**

- Checked against ui-standards in light and dark at 320 and 1280px: contrast, 24px targets, no clipped or overflowing content, and automatic accessibility checks clean.
- Fixed along the way: lists and sheets that were squashed and would not scroll, a footer button that wrapped, and a Discount field that lost a wrong value instead of showing the error.
- Nothing in this ticket's scope was skipped: VAT warning, review, money date ranges, setup steps, Opening balance wording, logo, Job Done date, Refund, Write-off, Cancel, Revision, Credit, Deposit applied, separate Receipts, follow-up, Call/WhatsApp and contacts import are all shown.
- Left as stubs: the Backup screen, and Call, WhatsApp and Share, which open other apps. The PDF layout belongs to the Document PDF prototype.
