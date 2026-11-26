# Automatic Google Drive backup

Label: wayfinder:research
Type: research
Status: resolved

## Question

What free ways can the app back up automatically to the user's own Google Drive (Drive API with app-data or drive.file scope, Android Auto Backup, a Storage Access Framework folder)? For each: size limits, OAuth client, consent-screen and verification needs without a domain, token expiry, background reliability, whether it works for an app installed outside the Play Store, restore onto a new phone, and encryption. Can it be fully automatic, and can a password protect it?

## Answer

[docs/research/google-drive-backup.md](../../../docs/research/google-drive-backup.md) (documentation only, nothing tested).

- Looks feasible and free: Drive API with the `drive.file` scope, dated backups encrypted by the app before upload, in a visible folder. Unattended after one consent, but Android can delay it.
- The consent screen must be In production: in Testing, consent expires after 7 days.
- Android Auto Backup: 25 MB, latest copy only, awkward restore. Turn it off deliberately (Expo leaves it on), or records bypass the backup password.
- Storage Access Framework: no source shows Drive supports an automatic folder; manual export only.
- Unknown: publishing In production with no domain (Google's pages conflict), background tokens on real phones, a second phone's access to existing backups.
