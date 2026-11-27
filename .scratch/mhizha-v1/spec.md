# Mhizha version 1 spec

Status: ready to build from (owner, 2026-11-27). Assembled from the resolved tickets of the [Mhizha v1 map](map.md). Each section links the ticket that holds the full decision; where this page and a ticket disagree, the ticket wins and this page is fixed. Words in capitals (Customer, Invoice, Deposit) mean what [GLOSSARY.md](../../GLOSSARY.md) says. Not reviewed by an accountant or tax adviser.

No gaps are open; see the end.

## 1. What it is

- Mhizha is an offline Android app for construction service providers (plumbers, builders, electricians and similar trades) who quote, invoice and take payments for Jobs at a Customer's Site. Zimbabwe first. ([Product name and open source](issues/22-product-name-and-open-source.md))
- One User, one phone, offline, no login, no server. Every record has a globally unique ID so syncing can come later.
- Version 1 serves a Business not registered for VAT. USD only.
- GPL-3.0, public repo `tamukamasvingise/mhizha`, issues only, no outside code. The name Mhizha and its logo are not licensed.
- Zero budget: no server, domain, Play Store, paid service, paid API or AI inside the app.

## 2. Platform, build and delivery

- **Stack:** Expo SDK 58 + TypeScript, expo-sqlite, expo-print (PDF), expo-file-system, expo-crypto, expo-local-authentication (app lock), expo-secure-store (backup password), expo-notifications (reminders), expo-contacts (optional import), expo-build-properties (minSdk 29). The Share menu and a file picker are needed for Backup and Restore; their modules are picked when building. No Node.js inside the app. pnpm, never npm. ([Expo capabilities and build limits](issues/04-expo-capabilities-and-build-limits.md))
- **Baseline phone:** Android 10, 2 GB RAM, 720p, no fingerprint reader, 32-bit. The APK runs on 32-bit and 64-bit phones (armeabi-v7a and arm64-v8a). minSdk 29.
- **Build:** GitHub Actions runs `expo prebuild` then Gradle. Expo cloud builds are not used. ([Build route](issues/15-build-route.md))
- **Package names:** `io.github.tamukamasvingise.mhizha` (permanent); test builds `io.github.tamukamasvingise.mhizha.test` with their own test key, installing beside the real app. ([Signing and delivery](issues/11-signing-and-delivery.md))
- **Signing:** one release key held by the developer, never the User. Copies: GitHub Actions secrets, an encrypted offline USB stick, the developer's password manager or encrypted cloud storage. Never in the repo. No User ever holds a copy. Losing every copy, or the developer stopping, means a build under a new key: the User makes a Backup, uninstalls, installs the new build and Restores. Anyone may make such a build under the GPL. This is explained on the site and in Help. ([Handover and support](issues/26-handover-and-support.md))
- **Version code** rises with every build. Going back means rebuilding old code under a higher number.
- **Delivery:** Mhizha is public and self-service; no single Business is assumed and nobody installs it for the User. Each signed `v*` release on GitHub Releases attaches the APK as `mhizha.apk` with its checksum. A GitHub Pages site has a **Download Mhizha** button linking straight to `https://github.com/tamukamasvingise/mhizha/releases/latest/download/mhizha.apk`, with the checksum beside it. The site shows an install guide before the download: allow the browser to install apps, turn Samsung's Auto Blocker off, install, open once, turn Auto Blocker back on. The same steps cover every update, installed over the old version. No developer account today; Google's developer verification is out of scope for now, though public distribution makes it matter from January 2027. Declare no SMS, notification-listener or accessibility permissions. ([Handover and support](issues/26-handover-and-support.md), [Installing outside the Play Store](issues/02-installing-outside-the-play-store.md))
- **In the app:** Settings shows the version number and short plain-language notes on what changed.
- **Update check:** **Check for updates** in Settings reads a small version file on the GitHub Pages site. An automatic check runs at most once a day, when the app opens with internet; a setting turns it off. A newer version shows a Home banner, "Mhizha 1.2 is ready. Make a Backup, then download.", with **Download**; it stays until the User updates or dismisses it for that version. No Android notification, nothing in the background, and nothing about the User is sent.
- **Proven on GitHub's Android 10 and 16 emulators:** an install over the old version keeps every record and PDF; a build signed with the wrong key and a downgrade are both refused; the safety copy and the upgrade steps work. Confirmed on a Galaxy S22 Ultra (Android 16, One UI 8.0); Samsung's Auto Blocker must be turned off first. No cheap real phone: the Android 10 emulator stands in for the baseline, and the 32-bit build is shipped untested. ([Real phone check](issues/05-accounts-and-test-phone.md)) ([Install and update proof](issues/13-install-and-update-proof.md))
- **APK:** one APK carrying arm64-v8a and armeabi-v7a (about 40 MB), no x86_64. Test builds add x86_64 for the emulator. ([Test strategy](issues/24-test-strategy.md))
- **Known build facts:** list config plugins (expo-sqlite) in `app.config.js` by hand; `expo install` cannot edit it. pnpm build scripts are approved only when the build fails without them, each recorded in `package.json` with a one-line reason.

## 3. App shell and look

From [Main screens prototype](issues/09-main-screens-prototype.md) (branch `prototype/main-screens`).

- Phone only, portrait. No tablet or wide layouts.
- Four bottom tabs: **Home, Customers, Documents, Money**, with small outline icons and labels. One **New** button for a Quotation, Invoice, Payment or Customer. Settings is a gear at the top right, beside the Mhizha mark.
- **Home:** "Customers owe you" is the one big figure, with the "Needs you" list under it. The VAT threshold notice stays on Home until "Got it", then shows only on Money. The Review is an "Open review" card until it is finished, never a pop-up.
- **Documents list:** Drafts first, then the newest Issued; filters for Drafts, Quotations, Invoices and Receipts. A Customer's own list uses the same order.
- **Money:** money received, invoiced sales, money owed, and Deposits and Credit held, for any date range. It never shows profit or cash in hand.
- **Quotations and Invoices** are made step by step, one question per screen: who, which Job, the lines, then check and issue. No feature appears twice.
- **Colour:** one orange accent on greys. Light and dark follow the phone. The tokens in the ticket become the app's `DESIGN-SYSTEM.md`. Red only for errors, overdue amounts and Cancel. No warning or success colours.
- **Help:** a Help page in Settings carries the site's tutorials built in, so it works offline: make a Quotation, turn it into an Invoice, record a payment, make a Backup, Restore. Every empty screen says what to do next. No tutorial overlay. ([Handover and support](issues/26-handover-and-support.md))
- Every screen meets the ui-standards quality bar (contrast, 24px targets, no clipping) in light and dark.

## 4. First open and setup

- The setup wizard guides first use; nobody sets the app up for the User.
- **First screen** of a new install: "Start new" or "Restore from a backup". ([Backup and restore](issues/10-backup-and-restore.md))
- **Setup order** for Start new: business details and logo, Document numbers, Start date, Accounting period, Opening balances (can be skipped), sales before the Start date (can be skipped), App lock. Both skippable steps can be reached later from Settings.
- **Business details:** name, trading-as line (optional), "what we do" line, phones, email, structured address, tax number, logo, brand colour (a premade colour or its own; a colour too pale for small text is darkened for text only), font (Inter by default, IBM Plex Sans, Manrope or Source Serif 4, all built in), optional faint logo watermark (off by default), payment details (bank, account name and number, branch, mobile money), and an optional signature drawn once. ([Document PDF prototype](issues/08-document-pdf-prototype.md))
- **Document numbers:** the starting number of each type is settable, and locks after the first Document of that type is Issued. There is no import of old records.
- **Start date:** today by default. ([Opening balances](issues/18-opening-balances.md))
- **Accounting period:** monthly, every 3 months or yearly, and the month the year starts. Prefilled with monthly and January. A change takes effect from the next period. ([Accounting foundation](issues/19-accounting-foundation.md))
- **App lock:** uses the phone's own lock (fingerprint, face, PIN, pattern or password). The app has no password of its own. It is off unless chosen: the app asks once, at setup, and only if the phone has a screen lock. No reminders. It can be changed in Settings.

## 5. Customers, Sites, Jobs, Price list

- A Customer (person or organisation) has phones, WhatsApp, email, structured address, tax number, notes, and one or more Sites. A Site has a structured address and an optional contact person. A Job is one piece of work at one Site.
- **Customer screen:** contact details, notes, Call and WhatsApp buttons, Document history, balance owed, Deposits and Credit held, Opening balance items, and a follow-up date with a reminder. Importing from the phone's contacts is optional.
- **Job:** Open, Done or Dropped, set by hand; it controls no Document. Marking Done asks for the date work finished: today by default, earlier allowed, never later. Closing a Job with money owing or an unused Deposit warns, and offers to move the Deposit to Credit. ([Document lifecycle](issues/06-document-lifecycle.md), [Money and VAT rules](issues/07-money-and-vat-rules.md))
- Customers, Sites and Jobs with Issued Documents or Payments can be archived, never deleted.
- **Price list:** name, unit, unit price. Not stock. A line copies its values from the Price list and can be changed on each Document.

## 6. Documents

Full rules: [Document lifecycle](issues/06-document-lifecycle.md).

- **Types and numbers:** Quotation QUO-0001, Invoice INV-0001, Receipt REC-0001, Refund REF-0001. Each type has its own sequence, never restarted and never reused, Cancelled numbers included. Every future type gets a three-letter prefix.
- **Draft:** has no number, can be previewed marked DRAFT, can be deleted, and can't be shared or printed. **Issuing** gives it a number and locks it. Issued Documents are never deleted.
- **Issue date and time** are set by the app and can't be edited. If the phone clock is earlier than the last recorded entry, issuing is blocked until the clock is corrected.
- **Frozen copy:** an Issued Document keeps the Business, Customer, Site and Job details it printed.
- **Quotation:** Draft, Issued, then Accepted or Declined (set by the User, with a date), or Cancelled. Valid until defaults to 30 days; Expired is worked out and locks nothing, and accepting after expiry warns. A Revision keeps the same number (QUO-0012 Rev 2) and makes the older one Superseded. Only the latest Revision can be accepted. An Accepted Quotation can be revised only before an Invoice comes from it, and the Revision must be accepted again. Accepting can be undone, and a Quotation declined or cancelled, only with no active Invoice; a Deposit on it moves to Credit first. A Quotation can carry Deposit asked and lead time.
- **Invoice:** made from an accepted Quotation (copying its lines to a Draft), or with no Quotation. Invoicing an unaccepted Quotation asks to accept it first. One Quotation can have several Invoices; the Quotation shows invoiced and remaining amounts, and going over warns. Status is always worked out: Unpaid, Part-paid, Paid, Overdue (past the due date with money owing), Closed (a Write-off covers the rest). The due date defaults to the issue date. An Invoice can carry the Customer's Order No.
- **Payment:** one Payment can cover several Invoices of one Customer and Deposits on that Customer's accepted Quotations. Ticked Invoices fill oldest first, and the amounts can be changed. Part-payment is allowed. Date received defaults to today, may be earlier, and is never in the future. Payment methods: Cash, Bank transfer, Card (swipe), EcoCash, InnBucks, Other (with a short description). Unused methods can be hidden.
- **Receipt:** issued automatically when a Payment is saved, after a confirmation screen. There are no Draft Receipts. One Payment gives one Receipt listing each Invoice, Job, amount applied and balance left, unless "Separate receipts" was chosen, which gives one per Invoice.
- **Deposit** is applied automatically when an Invoice is issued from its Quotation, up to the Invoice total. The User may reduce it, and the rest waits for the next Invoice. **Overpayment** becomes Credit after confirmation. Credit is suggested and applied only when the User agrees. Applying a Deposit or Credit issues a "Deposit applied" or "Credit applied" Receipt that names the original Receipt, says no new money was received, has no Payment method, and is kept out of money totals.
- **Refund:** returns unused Deposit or Credit, up to what is held: amount, date, method, reason.
- **Write-off:** closes a remainder that will never be paid, with a reason. It can be undone. It is for bad debt only; a price change means cancel and replace. It must be undone before later money is applied, and is reversed if its Invoice is Cancelled.
- **Cancel:** needs a reason, and counts on the day it is made. Cancelling an Invoice keeps its Payments and money Receipts, cancels its applied Receipts, and returns the money to the Deposit or to Credit. "Cancel and replace" opens a Draft copy and suggests the released money. Cancelling a money Receipt cancels its Payment and reopens its Invoices. This is refused while that money has been used or refunded, and the app lists the uses to undo first. A Refund can also be Cancelled.

### Rules that must always hold

1. Net money received = valid Payments - valid Refunds = money applied to active Invoices + unused Deposits + Credit.
2. Balance owed = active Issued Invoices + open Opening balance items - money applied - Write-offs. Quotations are never debt.
3. Deposits and Credit are money owed to the Customer. They are shown separately, never silently set off against debt, and never counted as earned.
4. No entry is zero or negative. Nothing is applied beyond a balance, or twice.
5. A Payment, its split and its Receipt save together or not at all.
6. Applied Receipts, Quotations and Drafts never count as money received.
7. Nothing Issued or recorded is erased.

## 7. Money, Discount and VAT

From [Money and VAT rules](issues/07-money-and-vat-rules.md).

- USD in whole cents. Quantities have up to 3 decimals, stored as thousandths. No floating-point sums.
- Line amount = quantity x unit price, rounded to the nearest cent, half a cent up. Lines add up exactly to the Subtotal. Zero-price lines are allowed; negative lines are not.
- Subtotal - Discount + VAT = Total. An Issued Document's Total is above zero. No rounding to whole dollars.
- "The sum of" is written by the app: "One hundred and fifty US dollars and twenty-five cents only".
- **Discount:** one per Quotation or Invoice, as an amount or a percentage, chosen with a US$ | % switch. A percentage must be 0 to 99.9 ("Enter a percentage from 0 to 99.9."), rounds to the cent, shows as it is typed ("10% = US$25.80") and prints as "Discount (10%)". It is never above the Subtotal and never on single lines. It carries over to Invoices, Revisions and replacements, and is never taken twice. Several Invoices from one Quotation each take Discount x Invoice Subtotal / Quotation Subtotal; the last takes the leftover cents. The share is editable on the Draft, and the shares never add up to more than the Discount.
- **VAT in version 1:** no VAT button, no registration fields, nothing charged. The Invoice's VAT field is printed blank, not 0.00. No VAT wording. Each Issued Document records the tax status "not registered", which is kept separate from 0% and exempt.
- **VAT threshold warning:** sales over the last 12 months, counting each sale at the earlier of Invoice issued or work finished. Deposits, Quotations, Cancelled Invoices and Opening balances don't count; sales entered for the months before the Start date do. The app warns once at US$20,000 and once above US$25,000: "speak to ZIMRA or an accountant". If the months before the Start date were left blank, it says so. It never says the Business need not register.
- **Later, provided for:** automatic VAT from a VAT number and registration date, rates stored with their dates, time of supply rules, credit notes after registration, and fiscal records attached as their own tables. Not in version 1. ([VAT in Zimbabwe](issues/21-vat-in-zimbabwe.md), [Fiscalisation in Zimbabwe](issues/20-fiscalisation-in-zimbabwe.md))

## 8. Opening balances

From [Opening balances](issues/18-opening-balances.md).

- **Opening balance item:** a Customer can have several. Each has an old invoice number (or none), its date, the amount still owed, an optional note and an optional Job. It is not a Document: no number and no PDF. It is paid like an Invoice and never counts as Sales or towards the VAT threshold.
- **Credit held on the Start date:** entered as an Opening balance of Credit held, with a note. It can be attached to a re-created Quotation, where it becomes that Quotation's Deposit.
- **Dating:** always dated at the Start date, and can be added at any time from a Customer. Cancelled with a reason and entered again if wrong. A debt that will never be paid gets a normal Write-off.
- **Wording:** never "before the app". Customer screen: "Opening balance · invoice 1234 · 3 March 2026 · US$450.00 owed"; Receipt line: "Opening balance (invoice 1234)"; applied Receipt: "Credit applied from opening balance".
- **Sales before the Start date:** optional, one total for each of the 12 months before it. Used only by the VAT threshold warning, and posts nothing.

## 9. Accounting, behind the scenes

From [Accounting foundation](issues/19-accounting-foundation.md). The User never sees debits, credits or account names.

- **Entries:** every money event posts a balanced double entry in the same save as its Document. Entries are never edited or deleted; corrections are reversing entries dated the day of the correction. Quotations, Drafts and Jobs post nothing.
- **Postings:**

| Event | Debit | Credit |
|---|---|---|
| Invoice issued, after Discount | Customers owe | Sales |
| Payment | Money account | Customers owe, Deposits held or Credit held |
| Deposit or Credit applied | Deposits or Credit held | Customers owe |
| Deposit moved to Credit | Deposits held | Credit held |
| Refund | Deposits or Credit held | Money account |
| Write-off | Bad debts | Customers owe |
| Opening balance owed | Customers owe | Opening balances |
| Opening balance Credit held | Opening balances | Credit held |
| Cancellation or undo | Exact reverse of the original | |

- **Accounts:** Customers owe, the money accounts (one per Payment method; Bank transfer and Card share Bank), Deposits held, Credit held, Opening balances, Owner's equity, Sales, Bad debts, plus hidden Unearned income and Unbilled work. Customer ledgers always equal the Customers owe, Deposits held and Credit held accounts. Accounts have permanent codes and are only ever added.
- **Dates:** a Payment belongs to its Date received. Money received before its Invoice date is held for the Customer until that date, then applies without an extra Receipt. Version 1 closes no period; it warns, but allows, a Date received in an earlier year.
- **Period-end adjustments, hidden:** invoiced but not finished: debit Sales, credit Unearned income. Finished but not invoiced: debit Unbilled work, credit Sales. They are dated the last day of the period, post when the Review is finished (or at the end of the next period), and reverse on the first day of the next period. They never change Documents, balances, the sales shown, or the VAT total. Full mechanics are in the ticket.
- **Checks:** debits equal credits, and the ledger agrees with the Customer balances. A failed check warns and changes nothing. The checks run after every Restore.
- **Review:** offered once at the end of each Accounting period ("Your October review is ready: 4 items") and can be opened at any time. It is a list of plain sentences with buttons, using only existing actions. It can be done in parts and never blocks work. Each answer is kept with its date. The items to find and their actions are in the ticket. Version 1 locks nothing when it is finished.

## 10. Document PDFs

From [Document PDF prototype](issues/08-document-pdf-prototype.md) (branch `prototype/document-pdf`).

- **Format:** A4 for every Document, one unbranded layout, made with expo-print. The app does its own pagination. ([PDF generation in Expo](issues/03-pdf-generation-in-expo.md))
- **Layout:** centred letterhead (trading-as line, logo, name, phones, address); title and number with the dates; Customer beside Site / Job; lines table (#, Description, Qty with unit, Unit price, Amount); totals with the sum in words; the Business's own signature line only (no customer signatures); footer with the "what we do" line, the number and "Page n of N".
- **Empty and long Documents:** an empty optional field is left off. A long Document continues with a short header on each later page ("continued"); totals, terms and signature come after the last line only.
- **Per Document:** Quotation terms (validity, Deposit asked, lead time) and the Revision line; Invoice payment details, Quote ref. and Order No., a blank VAT row, "Deposit applied (REC-…)" then Balance due; Receipt "Received from", Payment method tick boxes, a large USD amount box and a table of what was paid; applied Receipts and Refunds as the ticket shows.
- **Cancelled:** a CANCELLED stamp on every page, with the date, reason and replacement number. It never adds a page, and the original PDF is kept.
- **When PDFs are made:** once, at issue, and kept as a file with a checksum. Drafts are rebuilt on each preview. Sharing uses the phone's Share menu.

## 11. Backup and restore

From [Backup and restore](issues/10-backup-and-restore.md).

- **Back up:** in Settings, makes one complete file (`Mhizha backup 2026-11-26 14-30.mhizha`) holding every record, PDF, logo and setting, locked with the backup password. It opens the Share menu; the app keeps no copy. It then asks "Did you save the backup somewhere safe?": Yes records the date, No shows "Not backed up". A failure says why in plain words and leaves no half-made file.
- **Password:** at least 8 characters, typed twice at the first Backup. It is kept in the phone's secure storage, never in the database or the file, and can't be recovered. Settings shows it after the phone's lock and can change it; a change applies to new Backups only.
- Android's own app backup is turned off.
- **Reminder:** when something has changed and the last Backup is more than 7 days old, "Needs you" shows it and the phone shows one notification a week.
- **Restore:** from the first screen, or from Settings, which replaces everything after a safety copy and the User typing RESTORE. The app picks the file, asks for the password, then shows the Business, the backup date, counts, and the last number of each type. It then asks for the last number of each type issued after the backup, so numbering continues without reuse; the missing numbers become Review items. Older Backups are upgraded; newer ones are refused ("Update Mhizha first, then restore"). The ledger checks run afterwards.

### Re-entering records after a restore

From [Re-entering records after a restore](issues/28-re-entering-records-after-a-restore.md). Every issued number is accounted for, each record is entered on the date it happened from the copy the Customer has, and no number is reused.

- **Review item:** one per type lists the missing numbers ("INV-0045 to INV-0047 were issued after your last Backup."). Each number has **Enter again** and **Mark as lost**. The item stays open until every number is dealt with.
- **Enter again:** opens a Draft already set to that number. The User picks the Customer, enters the original issue date (between the Backup and the Restore) and types the lines from the Customer's copy. Issuing posts it normally on that date. The new PDF carries one small line: "Re-entered on 27/11/2026 after a restore."
- **Other types:** Receipts, Refunds and Quotations are entered again the same way, under their own numbers and dates; a Receipt is then applied to its Invoices as usual. The app suggests Invoices first, then Receipts.
- **Details gone:** if no copy survives but the Customer and total are known, the Document is entered again as one line, "Details lost after a restore", with the real total.
- **Mark as lost:** needs a reason. The number stays used and shows as Lost, like a Cancelled number but carrying no money. Lost can be undone into Enter again if a copy turns up.

## 12. Data and storage

From [Data model](issues/12-data-model.md), which holds the full table list.

- **IDs and timestamps:** every record has a UUID v7, its install ID, created and last-changed times, and a change counter. Printed numbers are separate fields.
- **Deleting:** only Drafts, Price list items and hidden settings can be deleted. A delete leaves a marker; nothing is erased.
- **Times and dates:** times are stored in UTC with the time zone (Africa/Harare). Accounting dates, Date received and the date work finished are plain dates.
- **Facts, not states:** what happened is stored; statuses and balances are always worked out.
- **Integrity:** each action that touches several records saves as one unit. Foreign keys are enforced. The database refuses zero or negative amounts.
- **Files:** logos, signatures and PDFs are files with an ID and a checksum, and are never overwritten. Business details, the Accounting period and Payment methods are kept with the date each took effect.
- **Database upgrades:** numbered, forward-only steps tracked by `PRAGMA user_version`, each in its own transaction, logged in `upgrade_log`. Before upgrading, a safety copy is made with SQLite `VACUUM INTO` and opened to check it. If a step fails, the app returns to the copy and says so. Restoring an older Backup runs the same steps. ([Install and update proof](issues/13-install-and-update-proof.md))

## 13. Noticing problems and support

From [Noticing problems with no server](issues/25-noticing-problems-with-no-server.md) and [Handover and support](issues/26-handover-and-support.md).

- **Error log:** kept on the phone. Each entry: time, app version, database version, the screen or job, the error text. Records are referred to by ID only, never their contents (no names, phone numbers, amounts or descriptions). Keeps the last 500 entries.
- **Unexpected errors:** caught and shown as a plain screen, "Something went wrong. Your records are safe.", with **Restart** and **Send a problem report**. Native Android crashes are not caught; Android's own dialog covers them.
- **Ledger checks on every open:** the ledger balances and the seven rules hold. A failure is logged and shows a red banner, "A check failed. Please send a problem report." Work is not blocked; a fix is a correcting entry, never an edit.
- **Failed upgrade or Backup:** besides the plain-words message, each is logged.
- **Problem report:** Settings, **Send a problem report**, makes one plain-text file `Mhizha problem report 2026-11-27.txt`: versions, phone model and Android version, error log, upgrade log, ledger check results, record counts. It opens the Share menu. The User can open it first and see it holds no Customer details.
- **Support:** through GitHub issues, attaching the problem report; Help warns that issues are public. Best effort. No Backups are asked for. A Backup for diagnosis is sent only with the User's clear agreement, its password by a different route, never put in the repo, and deleted once the problem is fixed. A project email comes later; personal help only once Mhizha is a paid product.

## 14. Testing and release

From [Test strategy](issues/24-test-strategy.md).

- **Every push:** money and accounting logic is plain TypeScript, free of Expo, written test first with Vitest: money sums and rounding, Discount shares, the seven rules, every ledger posting and reversal, period-end adjustments, numbering. fast-check runs thousands of random sequences of Documents, Payments and reversals; after each step the seven rules hold and the ledger balances. Database upgrade steps and Backup and Restore round trips run on Node's built-in SQLite. Each release saves a small sample database of invented records (never client data), and every push upgrades each saved database to the current version. PDF content is checked through the page the PDF is made from (totals, VAT, Discount, number); no picture comparison.
- **On pull requests to main and release tags,** on GitHub's Android 10 (2 GB) and current emulators: the same database tests against the real expo-sqlite, and one adb smoke run: setup, add a Customer, a Quotation, turn it into an Invoice, take a Payment, check a PDF is made and opens, Backup, Restore.
- **Coverage:** no percentage target. Every rule, posting, reversal and upgrade step has at least one test.
- **Release:** only a `v*` tag on main signs with the release key, held in a GitHub environment that needs the owner's approval, and only if the every-push tests and both emulator runs passed on that commit. Every other build is a `.test` build signed with the test key.
- **Before each release,** a checklist in the repo is ticked in the release notes on the owner's Galaxy S22 Ultra: app lock, saving a Backup through the Share menu, reminders, installing over the previous version.

## 15. Out of scope for version 1

Several users or phones, sync and login; charging VAT and ZIMRA fiscalisation; stock, staff, expenses, profit, closing, financial statements and accountant export; automatic Google Drive backup; Play Store, iPhone, other currencies; importing old records; Google developer verification and the developer account route (not now); personal support before Mhizha is a paid product. See the map's Out of scope.

## 16. Open gaps

None. This spec is ready to build from.

[Reminders on real phones](issues/27-reminders-on-real-phones.md) was ruled out of scope for now (owner, 2026-11-27). Follow-up and backup reminders are built as described above but are not yet proven on a phone that closes background apps; the reminders line of the release checklist on the Galaxy S22 Ultra checks them before each release. The test app is on branch `prototype/reminders-on-real-phones`.
