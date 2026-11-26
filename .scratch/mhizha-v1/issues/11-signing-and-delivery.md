# Signing and delivery

Label: wayfinder:grilling
Type: grilling
Status: resolved
Blocked by: 02, 04, 15

## Question

Who holds the signing key and its copies, what is the permanent package name, which developer account route is used, and how does each new version reach the user's phone?

## Answer

Decided with the owner on 2026-11-26.

### Given by research

- An update keeps the app's data only with the same package name, the same signing key and a higher version code. Never uninstall to update.
- The version code rises with every build. Going back means rebuilding old code under a higher number.

### Package name

- Permanent, fixed before the first real install. It follows the new product name (reversed), decided in [Product name and open source](22-product-name-and-open-source.md); no client name in it.
- No domain is needed for a sideloaded app; the name can be registered with Google later, if nobody has claimed it first.

### Signing key

- The key is the developer's, never the user's. It proves each update comes from the same author; whoever holds it can replace the app on the phone.
- The owner creates one release key (keystore, strong password). Copies: GitHub Actions secrets for signing builds, an encrypted USB stick kept offline, and the owner's password manager or encrypted cloud storage. The password lives in the password manager. Never in the repo.
- If every copy is lost, no update is possible without uninstalling; recovery is a new install plus restore from backup.
- The owner alone holds it. Whether a user ever gets a sealed copy belongs to handover.

### Test builds

- Test builds, including the Install and update proof, use the real package name with a `.test` suffix and their own test key, through the same GitHub Actions pipeline. They install beside the real app and can never replace it.

### Delivery

- Now: direct APK install, no developer account.
- Each version: the owner takes the signed APK from GitHub Actions and shares it by Google Drive link. The user taps it and installs over the old version.
- Settings shows the version number and short plain-language notes on what changed. No in-app update check in version 1.

### Safety around an update

- The update message reminds the user to check the last backup is recent.
- On first open after an update, the app copies its database on the phone before upgrading it; if the upgrade fails, it returns to that copy and says so. Mechanics: Data model, Backup and restore.

### Out of scope (owner)

- The developer account route once Google's developer verification reaches Zimbabwe (advanced flow, ADB, limited or full account). Direct APK works today; from 2027 this may stop.
