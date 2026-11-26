# Install and update proof

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 03, 04, 11, 15, 22, 23

## Question

Build a throwaway test app; install it, save a record and a PDF, install a newer version over it, and confirm the data survives. Record every problem seen and how long each step took.

Owner, 2026-11-26: this runs on the Android emulator inside GitHub Actions, not on the owner's PC or a real phone. Run it on an Android 10 emulator with 2 GB RAM and a 720p screen (Google Play image) and on a current Android version. A script drives every step and saves a screenshot of each. Real phone checks follow in Real phone check.

From Signing and delivery: use the test package (real name plus `.test`) and the test key, built by GitHub Actions. Also check that installing over keeps the data and that the database copy is made on first open.

From Data model: the newer test version adds one numbered database upgrade step; check that it runs once, keeps every record and the PDF file, and that the upgrade log shows it.

## Answer

Run on 2026-11-27 on GitHub Actions: [passing run](https://github.com/tamukamasvingise/mhizha/actions/runs/45905060425). Prototype on the throwaway branch `prototype/install-update-proof` (test app, `build.sh`, `run-proof.sh`, workflow). Not run on a real phone: that is Real phone check.

### Proved

Every check passed on both emulators:

- Android 10 (API 29), 2 GB RAM, 720x1280, Google Play image
- Android 16 (API 36), 4 GB RAM, 720x1280, Google Play image

The checks:

- A fresh install of build 1 saves one Customer, one Document and its PDF; the PDF file matches its checksum. No safety copy on a new install.
- Reopening keeps the records and saves nothing new.
- An update signed with another key is refused (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
- Build 2 installs over build 1: version code 2, first install time unchanged, every record and the PDF unchanged.
- On first open after the update, the database is copied before upgrading, and the copy is opened and checked (version 1, one Customer).
- Upgrade step 2 runs once, shows once in the upgrade log, and does not run again on the next open.
- Build 3 has a step that fails on purpose: the app reports it, returns to the copy (database stays at version 2, records and PDF intact) and logs the failure.
- Installing an older version over a newer one is refused (`INSTALL_FAILED_VERSION_DOWNGRADE`).

### Timings

| Step | Android 10, 2 GB | Android 16 |
|---|---|---|
| Install build 1 | 44 s | 8 s |
| First open (database, record, PDF) | 13 s | 4 s |
| Install build 2 over build 1 | 25 s | 5 s |
| First open after update (copy, upgrade, checks) | 3.5 s | 2.5 s |
| Later opens | 2 to 3.5 s | 2.5 to 3.5 s |

Emulator times, not phone times. Building the three versions took about 18 minutes per run on GitHub Actions.

### Size

The APK is about 54 MB with three processor types (x86_64 for the emulator, armeabi-v7a and arm64-v8a for phones). The real app can build one APK per processor type to cut this.

### Problems seen

- `File.copy` from expo-file-system left no usable copy of the database, and gave no error. The safety copy and the return to it now use SQLite's `VACUUM INTO`, and the copy is opened and checked before any step runs.
- `expo install` cannot edit `app.config.js`, so config plugins (expo-sqlite) are listed by hand.
- On Android 10, clearing the emulator log is unreliable, so the script reads only the new app process's log.
- pnpm reports expo-sqlite build scripts awaiting approval. Harmless here; the real app must decide which to approve.
