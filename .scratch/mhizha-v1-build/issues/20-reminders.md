# 20: Reminders

**What to build:** The phone shows a notification when a Customer's follow-up date comes, and once a week when there are changes and the last Backup is more than 7 days old. Spec sections 5 and 11. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 05 Customers, Sites and Jobs, 17 Backup

**Status:** ready-for-agent

- [ ] Notification permission asked when the first reminder is set, with a plain reason
- [ ] Follow-up reminder on the date set on the Customer
- [ ] Weekly Backup reminder only when something changed and the last Backup is more than 7 days old; Needs you shows it too
- [ ] Reminders are set again after the phone restarts
- [ ] Not proven on phones that close background apps (Reminders on real phones is out of scope); the release checklist covers it
