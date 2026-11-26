# Handover and support

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

How does a Business get Mhizha and learn it: who installs the first APK and walks through setup, what training or help is in the app, how support requests reach the developer, and how updates are announced? Also settle the question left by Signing and delivery: whether a User ever holds a sealed copy of the signing key, for example if the developer stops maintaining the app.

From Real phone check: on Samsung phones (One UI 8), Auto Blocker refuses the APK until it is turned off. Decide how first install and each update guide the User through that, and whether to suggest turning it back on afterwards.

From Noticing problems with no server: settle who receives a problem report and a Backup sent for diagnosis, and by which route (WhatsApp, email), and where that contact is shown in the app.

## Answer

Decided with the owner on 2026-11-27. Mhizha is a public app: people find, install, set up and learn it themselves. No installer visit, no single Business assumed.

### Getting it

- Each signed `v*` release on GitHub Releases attaches the APK as `mhizha.apk` with its checksum.
- A GitHub Pages site has a **Download Mhizha** button linking straight to `https://github.com/tamukamasvingise/mhizha/releases/latest/download/mhizha.apk`, so nobody has to find their way around the repo. The checksum is shown beside it.
- This replaces the Google Drive link.

### Before installing

- An install guide on the site, shown before the download: allow the browser to install apps, turn Samsung's Auto Blocker off, install, open once, turn Auto Blocker back on. The same steps for every update.

### Learning

- Tutorials and help on the site; video may come later.
- The setup wizard guides first use. A **Help** page in Settings carries the same tutorials built into the app, so it works offline: make a Quotation, turn it into an Invoice, record a payment, make a Backup, Restore.
- Every empty screen says what to do next. No tutorial overlay.

### Updates

- This replaces "no update check".
- **Check for updates** in Settings, run when pressed, reads a small version file on GitHub Pages.
- An automatic check, at most once a day, when the app opens with internet. A newer version shows a Home banner: "Mhizha 1.2 is ready. Make a Backup, then download." with **Download**. It stays until the User updates or dismisses it for that version.
- No Android notification and nothing in the background. A setting turns the automatic check off. Nothing about the User is sent.

### Support

- Through GitHub issues, attaching the problem report from [Noticing problems with no server](25-noticing-problems-with-no-server.md). Help warns that issues are public.
- Best effort. No Backups are asked for, since they hold the Business's customers' records.
- A project email comes later (owner, not urgent). Personal help comes once Mhizha is a paid product.

### Signing key

- No User ever holds a copy. If the developer stops maintaining Mhizha, anyone can build the GPL code with their own key; the User makes a Backup, uninstalls, installs the new build, and Restores. This is described on the site and in Help.

### Not now

- Google developer verification stays out of scope for now, by the owner's choice, though public distribution makes it matter sooner (September 2026 in Brazil, Indonesia, Singapore and Thailand; globally from January 2027).
