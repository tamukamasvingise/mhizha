# Mhizha v1

Label: wayfinder:map

## Destination

A version 1 spec for Mhizha, an offline Android app for construction service providers, with a test app proven to install, update and keep its data on a real phone.

## Notes

- Skills: grilling, domain-modeling; prototype and ui-standards for anything visible; research for research tickets.
- The owner driving this map decides everything. A first Business serves as reference user; it is never named here.
- Zero budget: no server, domain, Play Store or paid service. No paid API or AI inside the app.
- Built with Claude Code on an 8 GB Windows PC. The GitHub repo is public. Commit and push map, ticket, glossary and research updates without asking; never force-push.
- Reference designs stay outside this repo. No client data or signing keys in this repo.

Settled while charting:

- Expo + TypeScript, SQLite on the phone. Build route: see Decisions. No Node.js inside the app.
- One user, one phone, offline, no login for now. Every record has a globally unique ID so syncing can come later.
- App lock uses whatever lock the phone has (fingerprint, face, PIN, pattern or password), with an on/off setting. The app has no password of its own for opening; the backup password is separate. Off unless the user chooses it: the app asks once, on first open, and only if the phone has a screen lock. No reminders; it can be changed in settings.
- A Customer has many Sites and Jobs; a Job is at one Site; a Quotation or Invoice belongs to one Customer and one Job.
- A Quotation becomes an Invoice in one tap; an Invoice may have no Quotation. Receipts come from Payments. Deposits can precede the Invoice.
- Drafts are editable; Issued Invoices and Receipts are locked, then cancelled and reissued; Quotations get Revisions.
- Price list without stock; prices can be changed per Document.
- CRM: contact details, notes, call and WhatsApp buttons, Document history, balance owed, follow-up date with reminder. Phone contacts import is optional.
- PDFs follow the reference layout, unbranded, USD only, continuing onto further pages when long: see Document PDF prototype.
- Version 1 serves a Business not registered for VAT. VAT: see Money and VAT rules.
- Backup covers all records and PDFs, is password-protected and restores onto a new phone. Version 1 backup is manual: "Back up" makes a password-locked file the user saves through the phone's Share menu (Drive, WhatsApp); "Restore" reads it on a new phone (owner, 2026-11-26).
- No import of old records; first Document numbers are settable.
- Baseline is the weakest phone: Android 10, 2 GB RAM, small 720p screen, no fingerprint reader, 32-bit. The APK must run on 32-bit and 64-bit phones. No specific model is required; test on GitHub's emulator (Android 10 and current) and on the owner's Galaxy S22 Ultra; no cheap real phone (owner, 2026-11-27).
- The full accounting cycle is provided for from day one, even though version 1 starts small: see Accounting foundation.

## Decisions so far

- [Installing outside the Play Store](issues/02-installing-outside-the-play-store.md): free today by direct APK; from January 2027 the advanced flow or ADB; the free limited account may exclude commercial apps.
- [PDF generation in Expo](issues/03-pdf-generation-in-expo.md): expo-print very likely works with the app doing its own pagination; designs are flat images, so source art is needed.
- [Build route](issues/15-build-route.md): GitHub Actions with Gradle; Expo cloud builds for the proof of concept only.
- [Automatic Google Drive backup](issues/01-automatic-google-drive-backup.md): feasible and free on paper with the Drive API and app-side encryption; publishing without a domain is unproven.
- [Expo capabilities and build limits](issues/04-expo-capabilities-and-build-limits.md): every needed feature is free in SDK 58, but Expo's Free plan may not cover a commercial app; GitHub Actions is a documented alternative.
- [Document lifecycle](issues/06-document-lifecycle.md): states, Payments split over Invoices, Deposits, Credit, Refunds, Write-offs, cancelling, numbering, and the money rules that must always hold.
- [Fiscalisation in Zimbabwe](issues/20-fiscalisation-in-zimbabwe.md): probably no duty on a Business not registered for VAT, unconfirmed; a later update is technically possible.
- [VAT in Zimbabwe](issues/21-vat-in-zimbabwe.md): no VAT may be charged before registration; afterwards the time of supply decides.
- [Money and VAT rules](issues/07-money-and-vat-rules.md): whole cents, one Discount per Document, no VAT in version 1 with automatic VAT provided for, date work finished, and a VAT threshold warning.
- [Accounting foundation](issues/19-accounting-foundation.md): balanced entries posted automatically from day one for customer money only, hidden period-end adjustments, and a plain-language review each accounting period.
- [Opening balances](issues/18-opening-balances.md): amounts owed or held on the Start date are Opening balance items, paid like Invoices but never Sales; optional monthly sales totals feed the VAT threshold.
- [Signing and delivery](issues/11-signing-and-delivery.md): one developer-held release key with three copies, a permanent package name from the new product name, separate `.test` builds, updates by Google Drive link.
- [Product name and open source](issues/22-product-name-and-open-source.md): the product is Mhizha, the owner's own, for construction service providers; GPL-3.0, issues only, a fresh public repo with the reference user named nowhere.
- [Go public](issues/23-go-public.md): planning continues in the public repo tamukamasvingise/mhizha (GPL-3.0); the old private repo is archived.
- [Main screens prototype](issues/09-main-screens-prototype.md): four tabs (Home, Customers, Documents, Money), one New button, step-by-step Documents, a Discount as amount or %, one orange accent on greys, phone only.
- [Backup and restore](issues/10-backup-and-restore.md): one manual password-locked file through the Share menu, weekly reminders when there are changes, restore from the first screen, and numbering that never reuses numbers issued after the backup.
- [Data model](issues/12-data-model.md): time-ordered random IDs, frozen details and PDFs kept at issue, facts stored and status worked out, a double-entry ledger with Customer ledgers and reversing entries, forward-only database upgrades, and the table list.
- [Design source files](issues/17-design-source-files.md): none needed; the layout is rebuilt from the reference PDFs with a made-up Business, a placeholder logo, dummy data and open-licence fonts.
- [Document PDF prototype](issues/08-document-pdf-prototype.md): one A4 layout for all Documents, each Business's own colour, font choice and optional watermark, no customer signatures, empty fields left off, and a CANCELLED stamp that never adds a page.
- [Install and update proof](issues/13-install-and-update-proof.md): on GitHub's Android 10 and 16 emulators, installing over keeps every record and the PDF, the wrong key and downgrades are refused, and the safety copy (SQLite VACUUM INTO) is made before an upgrade and returned to when a step fails.
- [Real phone check](issues/05-accounts-and-test-phone.md): install and update work on a Galaxy S22 Ultra; Samsung's Auto Blocker must be turned off; no cheap phone, the Android 10 emulator stands in; the 32-bit build stays untested.
- [Version 1 spec](issues/14-version-1-spec.md): [spec.md](spec.md) assembled from every decision; six gaps left as tickets, folded in by Finish the version 1 spec.
- [Test strategy](issues/24-test-strategy.md): Vitest and fast-check on every push for money, ledger, rules, upgrades from every release and Backup round trips; emulator smoke run on pull requests and tags; one arm APK; release key only on approved, all-green `v*` tags; S22 checklist before each release.
- [Noticing problems with no server](issues/25-noticing-problems-with-no-server.md): local error log with IDs only; plain error screen; ledger checks on every open with a red banner; a plain-text problem report sent through the Share menu; a Backup only with the User's agreement.

## Not yet specified

Nothing at present: the remaining fog graduated into tickets when the spec was assembled.

## Out of scope

- Several users, several phones, syncing and login: one user for now; a fresh effort later.
- ZIMRA fiscalisation and charging VAT: later updates; version 1 records leave room for both. Whether such a Business must fiscalise now is unconfirmed.
- Stock, staff, expenses, profit, closing, financial statements and accountant export: later versions; see Accounting foundation.
- The developer account route after Google's developer verification reaches Zimbabwe: owner's call, see Signing and delivery.
- Play Store release, iPhone, other currencies, and importing old records.
- [Google Cloud without a domain](issues/16-google-cloud-without-a-domain.md): automatic Google Drive backup is out of version 1, so no Google Cloud project is needed; backup is manual through the Share menu (owner, 2026-11-26).
