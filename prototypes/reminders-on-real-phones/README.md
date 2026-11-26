# Reminders on real phones (PROTOTYPE, throwaway)

Answers the Reminders on real phones ticket: do scheduled reminders arrive on a
Samsung phone when the app has been closed for days, after a restart, and with
battery saver on? Not Mhizha code; lives only on this branch.

`build.sh` runs on GitHub Actions and produces `reminders-test.apk`. The app
schedules reminders at 10 min, 1 h, 3 h, 8 h, 1, 1.5, 2 and 3 days, plus one
daily at 09:00, and on each open lists which arrived, when, and which are missing.
