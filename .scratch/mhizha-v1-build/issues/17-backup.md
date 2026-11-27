# 17: Backup

**What to build:** The User makes a password-locked Backup file and saves it through the Share menu. Spec section 11. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 13 Cancel, replace and Write-off

**Status:** ready-for-agent

- [ ] Back up in Settings makes one file (`Mhizha backup 2026-11-26 14-30.mhizha`) with every record, PDF, logo and setting; the app keeps no copy
- [ ] Password at least 8 characters, typed twice the first time, kept in secure storage, shown after the phone's lock, changeable for new Backups
- [ ] "Did you save the backup somewhere safe?": Yes records the date, No shows Not backed up
- [ ] A failure says why in plain words, leaves no half-made file and is logged
- [ ] Android's own app backup is turned off
- [ ] Backup round trip tested on Node's SQLite every push
