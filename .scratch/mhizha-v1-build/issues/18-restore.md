# 18: Restore

**What to build:** The User restores a Backup on a new phone from the first screen, or replaces everything from Settings, and numbering carries on without reuse. Spec section 11. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 17 Backup

**Status:** ready-for-agent

- [ ] Restore from the first screen, or from Settings after a safety copy and typing RESTORE
- [ ] Pick the file, enter the password, see the Business, backup date, counts and last number of each type
- [ ] Ask for the last number of each type issued after the Backup; numbering continues from there
- [ ] Older Backups are upgraded with the normal steps; newer ones refused: "Update Mhizha first, then restore"
- [ ] Ledger checks run afterwards
- [ ] Backup and Restore round trip tested on Node's SQLite and on the emulator
