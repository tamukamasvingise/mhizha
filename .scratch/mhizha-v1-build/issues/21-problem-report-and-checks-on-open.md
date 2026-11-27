# 21: Problem report and checks on open

**What to build:** The app checks its ledger every time it opens, and the User can send a plain-text problem report through the Share menu. Spec section 13. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 02 Database base, 03 Money and ledger core

**Status:** ready-for-agent

- [ ] On every open the ledger balances and the seven rules are checked; a failure is logged and shows a red banner "A check failed. Please send a problem report." without blocking work
- [ ] Send a problem report in Settings and on the error screen makes `Mhizha problem report <date>.txt`: versions, phone model, Android version, error log, upgrade log, check results, record counts
- [ ] The report holds no Customer details and the User can open it before sharing
