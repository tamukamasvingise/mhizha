# Test strategy

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

What must the automated tests of the real app cover, and at what level: money sums and rounding, the Discount shares, the seven rules that must always hold, every ledger posting and reversal, the period-end adjustments, numbering, database upgrade steps, and Backup and Restore round trips? Which run on every push and which on the GitHub emulator?

Also settle the CI build of the real app: one APK per processor type or one combined APK, which pnpm build scripts to approve (expo-sqlite asked), and how the release key from GitHub Actions secrets signs only tagged releases. See Install and update proof and Signing and delivery.

From Real phone check: the app lock and saving a Backup through the Share menu are checked by hand on the owner's Galaxy S22 Ultra. No cheap phone; the Android 10 emulator is the baseline. The 32-bit build is never run.

## Answer

Decided with the owner on 2026-11-27.

### Every push

- Money and accounting logic in plain TypeScript, kept free of Expo, tested with Vitest, test first: money sums and rounding, Discount shares, the seven rules, every ledger posting and reversal, period-end adjustments, numbering.
- Property tests with fast-check: thousands of random sequences of Documents, payments and reversals; after each step the seven rules hold and the ledger balances.
- Database upgrade steps and Backup and Restore round trips on Node's built-in SQLite.
- Each release saves a small sample database of invented records (never client data). Every push upgrades each saved database to the current version.
- PDF content is checked through the page the PDF is made from (totals, VAT, Discount, number). No picture comparison.

### GitHub emulator (Android 10 2 GB and current), on pull requests to main and release tags

- The same database tests against the real expo-sqlite.
- One adb smoke run, no new tool: setup, add a Customer, a Quotation, turn it into an Invoice, take a payment, check a PDF is made and opens, Backup, Restore.

### Coverage

- No percentage target. Every rule, posting, reversal and upgrade step has at least one test.

### Build and release

- One APK with arm64-v8a and armeabi-v7a (about 40 MB), no x86_64. Test builds add x86_64 for the emulator.
- pnpm build scripts: approve none unless the build fails without it; each approval recorded in `package.json` with a one-line reason.
- Only a `v*` tag on main signs with the release key, held in a GitHub environment that needs the owner's approval. It builds only if the every-push tests and both emulator runs passed on that commit. Every other build is a `.test` build signed with the test key.

### Hand checks on the owner's Galaxy S22 Ultra, before each release

- A checklist in the repo, ticked in the release notes: app lock, saving a Backup through the Share menu, reminders, installing over the previous version.
