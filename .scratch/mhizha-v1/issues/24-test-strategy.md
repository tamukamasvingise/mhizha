# Test strategy

Label: wayfinder:grilling
Type: grilling
Status: open

## Question

What must the automated tests of the real app cover, and at what level: money sums and rounding, the Discount shares, the seven rules that must always hold, every ledger posting and reversal, the period-end adjustments, numbering, database upgrade steps, and Backup and Restore round trips? Which run on every push and which on the GitHub emulator?

Also settle the CI build of the real app: one APK per processor type or one combined APK, which pnpm build scripts to approve (expo-sqlite asked), and how the release key from GitHub Actions secrets signs only tagged releases. See Install and update proof and Signing and delivery.

From Real phone check: the app lock and saving a Backup through the Share menu are checked by hand on the owner's Galaxy S22 Ultra. No cheap phone; the Android 10 emulator is the baseline. The 32-bit build is never run.
