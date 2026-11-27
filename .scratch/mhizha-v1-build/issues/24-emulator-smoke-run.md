# 24: Emulator smoke run

**What to build:** On pull requests and tags, the emulator runs the main flow end to end on Android 10 and current. Spec section 14. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 18 Restore

**Status:** ready-for-agent

- [ ] adb run: setup, add a Customer, a Quotation, turn it into an Invoice, take a Payment, check a PDF is made and opens, Backup, Restore
- [ ] Runs on Android 10 (2 GB) and current emulators on pull requests to main and release tags
- [ ] No new tool beyond adb
