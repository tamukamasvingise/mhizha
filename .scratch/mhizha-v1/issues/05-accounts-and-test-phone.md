# Real phone check

Label: wayfinder:task
Type: task
Status: open
Blocked by: 13

## Question

After the Install and update proof passes on GitHub's emulator, get one cheap real phone (about 2 GB RAM, Android 10 or 11, ideally 32-bit). Install the test app by Drive link and check what the emulator cannot show:

- the warnings Android shows when installing outside the Play Store, and whether the advanced flow switch for unverified apps is offered
- the app lock with each lock type the phone has, including PIN only if available
- saving a Backup through the Share menu to WhatsApp and Drive
- speed on a weak phone, and that the 32-bit build runs

Record the phone's model, Android version, whether it is 32-bit, each warning seen and how long each step took.

## Owner decisions (2026-11-26)

- No new accounts: builds run on GitHub Actions and updates go by Google Drive link. No Expo account.
- No emulator on the owner's PC: the downloads are too big for the owner's internet. The emulator runs on GitHub Actions instead (free for a public repo), in the Install and update proof.
- No strong phone: the emulator covers a current Android version.

## Comments

### 2026-11-27: first real phone, Galaxy S22 Ultra

The owner installed the Install and update proof APKs (run 45905060425, `proof-apks`) by Google Drive on a Samsung Galaxy S22 Ultra, Android 16, One UI 8.0, August security update. Owner's report: every step worked as expected (v1 install, v2 over v1, the wrong-key build refused, v3 fails and returns to the copy, downgrade refused).

Not yet recorded: the exact install warnings (Auto Blocker, Play Protect, the Drive permission) and timings.

Still open: this is a flagship running the 64-bit build, so speed on a weak phone and the 32-bit build are unchecked. The app lock and the Share-menu Backup need a later build, since the proof app has neither.
