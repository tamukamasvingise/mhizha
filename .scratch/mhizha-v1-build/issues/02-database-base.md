# 02: Database base

**What to build:** The app keeps its records in SQLite and upgrades them safely: on first open after an update it makes a safety copy, runs the numbered upgrade steps, and returns to the copy if a step fails, saying so in plain words. Unexpected errors show a plain screen instead of crashing. Spec sections 12 and 13. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 01 Walking skeleton

**Status:** ready-for-agent

- [ ] Upgrade steps are numbered, forward-only, tracked by `PRAGMA user_version`, each in its own transaction, logged in `upgrade_log`
- [ ] A safety copy is made with `VACUUM INTO` and opened to check it before upgrading; a failing step returns to the copy
- [ ] Every record gets a UUID v7, the install ID, created and last-changed times and a change counter; foreign keys are enforced
- [ ] Error log on the phone, IDs only, never record contents, last 500 entries
- [ ] Unexpected errors show "Something went wrong. Your records are safe." with Restart and Send a problem report (the report itself comes later)
- [ ] Upgrade tests run on Node's built-in SQLite every push and on the real expo-sqlite in the emulator job
