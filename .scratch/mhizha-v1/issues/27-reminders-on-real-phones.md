# Reminders on real phones

Label: wayfinder:task
Type: task
Status: closed (out of scope)

## Question

On the owner's Galaxy S22 Ultra (Samsung is known for closing background apps), with a test build that has notifications: do the follow-up reminders and the weekly backup notification arrive on time when the app has been closed for days, after a restart, and with the phone's battery saver on? Record what fails and what the app must ask the User to allow (for example turning off battery optimisation for Mhizha).

## Out of scope

Ruled out of scope for now by the owner on 2026-11-27, before the multi-day test finished. Reminders stay in version 1 as specified, unproven on phones that close background apps; the S22 release checklist covers them.

- Test app: branch `prototype/reminders-on-real-phones` ([build run](https://github.com/tamukamasvingise/mhizha/actions/runs/45913793731)). It schedules reminders from 10 minutes to 3 days plus a daily one, and lists each as arrived, overdue or missing.
- Facts found: the built APK holds POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED, so it can ask to notify and can set reminders again after a restart. It does not hold SCHEDULE_EXACT_ALARM, so reminders may arrive late.
