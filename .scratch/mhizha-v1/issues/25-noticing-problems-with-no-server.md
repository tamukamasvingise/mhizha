# Noticing problems with no server

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

With no server and no analytics, how does a problem on the User's phone get noticed and diagnosed: a crash, a failed ledger check, a failed upgrade, a failed Backup? Settle what the app records about errors, what the User sees, and how the User sends the developer what is needed (for example a diagnostics file through the Share menu) without exposing Customer records.

## Answer

Decided with the owner on 2026-11-27.

- **Error log:** kept on the phone. Each entry: time, app version, database version, the screen or job, the error text. Records are referred to by ID only, never their contents (no names, phone numbers, amounts or descriptions). Keeps the last 500 entries.
- **Unexpected errors:** caught and shown as a plain screen, "Something went wrong. Your records are safe.", with **Restart** and **Send a problem report**. Native Android crashes are not caught; Android's own dialog covers them.
- **Ledger checks:** on every open the app checks the ledger balances and the seven rules hold. A failure is logged and shows a red banner, "A check failed. Please send a problem report." Work is not blocked: a fix is a correcting entry, never an edit.
- **Failed upgrade or Backup:** besides the plain-words message and keeping records safe, each is logged.
- **Problem report:** Settings, **Send a problem report**, makes one plain-text file `Mhizha problem report 2026-11-27.txt`: versions, phone model and Android version, error log, upgrade log, ledger check results, record counts. It opens the Share menu. The User can open it first and see it holds no Customer details.
- **Backup for diagnosis:** only with the User's clear agreement; the password goes by a different route from the file; never put in the repo; deleted once the problem is fixed.
- Who receives reports, and how, goes to [Handover and support](26-handover-and-support.md).
