# Backup and restore

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 01, 04

## Question

From the owner, 2026-11-26: version 1 backup is manual, no automatic Google Drive backup and no Google Cloud project. "Back up" makes one password-locked file, saved through the phone's Share menu; "Restore" reads that file on a new phone.

Which reminders, password handling does version 1 use, what does the user see when a backup fails, and what is the restore path on a new phone?

From Document lifecycle: restoring an older backup must never reuse Document numbers already issued since that backup. Records are kept at least six years.

From Money and VAT rules: leave room for later fiscal records, whose numbering can have no gaps after a restore or phone change.

From Accounting foundation: a restore must bring back ledger entries and review answers exactly, and run the ledger checks afterwards.

From Signing and delivery: the update message reminds the user to check the last backup; a lost signing key means reinstall plus restore.

## Answer

Decided by the owner, 2026-11-26.

**Making a backup**

- "Back up" in Settings makes one complete file, such as `Mhizha backup 2026-11-26 14-30.mhizha`, holding every record, PDF, logo and setting. The newest file is all that is needed.
- The file is locked with a backup password, kept because the file lives outside the app (Drive, WhatsApp, email) and would otherwise expose every Customer and every amount.
- The password is set at the first backup: at least 8 characters, typed twice. The app keeps it on the phone, so later backups don't ask. It is needed only to restore and can't be recovered, so the app says to write it down.
- Settings shows the password after the phone's own lock, if the phone has one, and can change it; a change applies to new backups only.
- The phone's Share menu opens to save the file (Google Drive, WhatsApp to yourself, email). The app keeps no copy; its temporary file is deleted after sharing.
- Android can't say whether the file was saved, so the app asks "Did you save the backup somewhere safe?" Yes records today as the last backup; No shows "Not backed up" and offers to try again.
- After a backup: "You only need the newest backup. You can delete older ones from Drive or WhatsApp." The app can't see or delete those copies; deleting them is safe, since Issued Documents are never deleted and each backup holds everything.
- A failed backup (for example, the phone is full) says why in plain words, saves nothing half-made, and leaves the last backup date as it was.
- Android's own app backup is turned off, so records never leave the phone without the backup password.

**Reminders**

- When anything has changed and the last backup is more than 7 days old, Home's "Needs you" shows "Back up: last backup 9 days ago", and the phone shows one notification a week until a backup is made. No changes, no reminders.

**Restoring**

- A new install's first screen offers "Start new" or "Restore from a backup". Restore picks the file (Drive, WhatsApp, Downloads), asks for the password, then shows the Business name, backup date, number of Customers and Documents, and the last number of each Document type, before the user taps Restore.
- Restore in Settings, on a phone that already has records, replaces everything: the app first makes a safety copy and asks the user to type RESTORE.
- The app asks: "Did you issue any Documents after <backup date>? Enter the last number of each type you issued." Numbering continues after those, so no number is ever reused. The missing numbers appear in the Review as "Issued after the last backup, not in the app".
- A backup from an older app version is upgraded on restore. One from a newer version is refused on an older app: "Update Mhizha first, then restore."
- After a restore the ledger checks run, as Accounting foundation requires.

Re-entering the Documents and money that were issued after the last backup is left in Not yet specified.
