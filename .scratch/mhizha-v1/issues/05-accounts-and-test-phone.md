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
