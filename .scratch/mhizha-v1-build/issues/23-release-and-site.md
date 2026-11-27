# 23: Release and site

**What to build:** A `v*` tag produces a signed `mhizha.apk` on GitHub Releases, and the GitHub Pages site lets anyone download and install it. Spec sections 2 and 14. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 18 Restore, 22 Help and update check

**Status:** ready-for-agent

- [ ] Only a `v*` tag on main signs with the release key, in a GitHub environment needing the owner's approval, and only when every-push tests and both emulator runs passed on that commit
- [ ] Package `io.github.tamukamasvingise.mhizha`; one APK with arm64-v8a and armeabi-v7a; version code rises every build
- [ ] Release attaches `mhizha.apk` and its checksum; notes include the ticked S22 checklist (app lock, Backup through Share, reminders, install over the previous version)
- [ ] Each release saves a sample database of invented records; every push upgrades each saved database
- [ ] Pages site: Download Mhizha button to the latest-release URL with the checksum, install guide shown first (Auto Blocker off, install, open once, back on), tutorials, version file, what to do if the key ever changes
- [ ] The release key never enters the repo
