# Installing outside the Play Store

Researched 2026-11-25 for `.scratch/mhizha-v1/issues/02-installing-outside-the-play-store.md`.
Pages were fetched that day. Nothing was tried on a phone and no account was opened.

## Answer

- **Now:** the verification rule does not block a directly installed APK in Zimbabwe. It covers participating stores in four other countries.
- **2027:** rollout starts in January and spreads over several months to every country and every installation source. The sources read give no date for Zimbabwe or for direct APK installs.
- **The limit is 50 devices.** Pages that say 20 are out of date.
- **The limited account is aimed at non-commercial use.** A business app does not fit its stated use, so it is not a safe foundation without Google's agreement.
- **The free route without that problem is the advanced flow:** a one-off 24-hour setup on each phone, kept on indefinitely. ADB from the PC is the backup. Full distribution costs $25.
- **An update keeps data** if the package name and signing key stay the same, the version code rises, and the app is never uninstalled.

## Verified

### Device limit: 50

- Google's blog, 19 November 2026: the limit was expanded "from 20 to 50 authorized devices". This is the newest source and the only one that explains both numbers. [B]
- The limited-distribution guide (updated 2026-10-28) [L] and its help page [H] say 50; [H] makes it 50 at any one time.
- Pages that still say 20: the guides landing page (updated 2026-08-18) [G]; the FAQ answer (dated 2026-06-18, before launch, although the page shows 2026-11-17) [F]; and help pages [C], [S] and [U], which show no date.

### Who the rule applies to, and when

- It applies to certified Android devices on Android 8 (API 26) or higher, through Google Play services [F]. That includes our Android 10 minimum.
- Live since 2026-09-30 for participating stores in Brazil, Indonesia, Singapore and Thailand [B]. Direct installs were not covered in that phase [F].
- Global rollout begins January 2027 with seven distributors, then gradually covers all countries and all installation sources "over several months" [B].
- Uncertified devices are exempt [V]. Checks also do not run in comprehensively sanctioned countries [F].
- Apps installed by ADB need no verification. Apps from an organisation's store on managed devices are also exempt [F].
- Once enforced, an unregistered app can be installed **or updated** only with the advanced flow on, or by ADB [F].

### Account choices

| | Limited | Full | None (advanced flow) |
|---|---|---|---|
| Cost | Free [L] | $25 once [C] | Free: no account needed [F] |
| ID check | No government ID [L] | Yes [G] | No [G] |
| Devices | 50 authorised [B] | Unlimited [C] | Any phone that did the setup [F] |
| Intended for | Students, hobbyists; "no commercial intent" [L] | Wide distribution [C] | Unverified developers [G] |

- The console terms describe limited accounts as for "non-commercial purposes" and say extra terms may be presented at sign-up [T].
- A limited account must be a personal account [S]. Organisation accounts are for commercial or professional activity and need a D-U-N-S number [A].
- A limited account needs a Google Account with 2-Step Verification, a payments profile holding legal name and address, and a contact email [L].
- Sources conflict on changing plan. The FAQ (2026-06-08) says limited accounts can migrate to full [F]; undated help says the plan cannot change, so open a new account and transfer the packages [C].
- Registering a package that already exists needs proof of its private signing key [P].

### Adding a device to a limited account

1. Open Devices in the console and give the phone a friendly name.
2. Scan the QR code with that phone, or send its owner the link. The link expires in 7 days.
3. The phone's owner confirms they know and trust the named developer; the phone makes a code.
4. Enter the code in the console and choose Add device.

Unauthorised phones can neither install nor update. Removing a phone stops its installs and updates until it is authorised again. All from [H].

**Trap:** a limited account can register only package names "never been seen before on Android" [H]. If this route is ever chosen, register the final name before any phone sees it.

### Advanced flow

1. Turn on Developer options. Go to System > Developer options > Allow apps from unverified developers [W].
2. Confirm nobody is coaching you, restart, and reauthenticate [F].
3. Wait 24 hours, then confirm with fingerprint, face or PIN [F].
4. Choose 7 days or indefinitely [F][W]. Each install still warns; tap Install anyway [W].

The setup is one-time. Developer options can be turned off afterwards. No ADB command skips the wait, but ADB installs do not need it [F]. Turning the flow off makes later updates of an unregistered app fail [F].

### Play Protect and the usual install prompt

- Android 8+ asks the user to allow installs for each source app [I].
- Play Protect may say it has not seen the app and recommend sending it for scanning, or ask to send it for a security check [D]. After the scan it reports safe or harmful [R].
- In select markets it **blocks** apps from browsers, messaging apps and file managers that declare RECEIVE_SMS, READ_SMS, notification listener or accessibility [D]. Google says this reached 185 markets [M]. Declare none of them.
- It warns if targetSdkVersion is more than two versions below the phone's API level [D].
- A wrongly flagged app can be appealed [D].

### Updates that keep data

- **Package name never changes.** A new name is a new app: no update, and users cannot transfer data between the two [N].
- **Same signing key.** A different signature fails as an incompatible update [O]. Without Play App Signing, a lost key means no more updates [K]. Make it valid for at least 25 years [K].
- **Key rotation** exists from Android 9, but is not recommended for Android 12 and earlier [Z]. Do not plan on it with our Android 10 minimum.
- **Version code rises each release.** Android refuses a lower code [J].
- **Never uninstall to fix an update.** App-specific files are removed on uninstall [Q]. `adb install -r` reinstalls keeping data [X].
- **Not a debug key for release builds.** It is generated by the build tools and insecure by design [K].
- **Expo:** cloud builds reuse stored credentials unless told otherwise [E1]; `eas credentials` can download them [E2]. Set the profile to `buildType: apk`, because an AAB cannot be installed directly [E3]. `autoIncrement` raises versionCode [E4].

## Recommendation

1. Release as a directly installed APK now. Plan for the advanced flow, set to indefinite, on the owner's phone and the user's phone before January 2027 if the setting is present. Use ADB if it is not.
2. Do not open a limited account for this app unless Google confirms in writing that a free app used by a business qualifies. Do not describe it as a hobby project to qualify.
3. Ask the owner whether $25 full distribution could be a later exception to zero budget. It gives the user the plainest experience and, unlike limited, accepts existing packages.
4. Before the first real install, freeze one package name and one release key. Keep two encrypted key backups outside the repo and outside Expo. Give development builds a different package name.
5. Test by installing version 1, adding data, then installing version 2 over it. Also check that an update signed with the wrong key is refused without losing data.
6. Take an in-app backup before every update. If the key is lost, the fallback is a new app plus a restore.

## Unverified

- The date Zimbabwe and direct APK installs are enforced.
- Whether a business app may use a limited account. Any extra terms appear only at sign-up.
- Whether the advanced-flow switch is already on phones in Zimbabwe, and where each manufacturer puts it.
- Whether an installed, unregistered app simply keeps running after enforcement. The sources speak of installs and updates, so this is an inference.
- Whether updates repeat Play Protect prompts, and whether Zimbabwe is among the 185 markets.
- Whether full-account sign-up accepts Zimbabwe. Play Console lists Zimbabwe for developer registration [Y], but that is a different console. How Google treats Zimbabwe for the sanctions exemption was not established.
- Whether the test phones are certified. Check Play Store > Settings > About [R].

## Sources

- [A] https://support.google.com/android-developer-console/answer/16641046
- [B] https://developer.android.com/blog/posts/android-developer-verification-2027
- [C] https://support.google.com/android-developer-console/answer/16640817
- [D] https://developers.google.com/android/play-protect/warning-dev-guidance
- [E1] https://docs.expo.dev/app-signing/managed-credentials/
- [E2] https://docs.expo.dev/app-signing/app-credentials/
- [E3] https://docs.expo.dev/build-reference/apk/
- [E4] https://docs.expo.dev/build-reference/app-versions/
- [F] https://developer.android.com/developer-verification/guides/faq
- [G] https://developer.android.com/developer-verification/guides
- [H] https://support.google.com/android-developer-console/answer/17131204
- [I] https://developer.android.com/studio/publish
- [J] https://developer.android.com/studio/publish/versioning
- [K] https://developer.android.com/studio/publish/app-signing
- [L] https://developer.android.com/developer-verification/guides/limited-distribution
- [M] https://blog.google/security/keeping-google-play-android-app-ecosystem-safe-2025/ (read through a summarising fetch)
- [N] https://developer.android.com/guide/topics/manifest/manifest-element
- [O] https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/content/pm/PackageManager.java (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, `INSTALL_FAILED_VERSION_DOWNGRADE`)
- [P] https://support.google.com/android-developer-console/answer/16640821
- [Q] https://developer.android.com/training/data-storage
- [R] https://support.google.com/googleplay/answer/2812853
- [S] https://support.google.com/android-developer-console/answer/16604405
- [T] https://developer.android.com/developer-verification/console/terms
- [U] https://support.google.com/android-developer-console/answer/16561738
- [V] https://support.google.com/android/answer/17065026
- [W] https://support.google.com/android/answer/17588095
- [X] https://developer.android.com/tools/adb
- [Y] https://support.google.com/googleplay/android-developer/answer/9306917
- [Z] https://source.android.com/docs/security/features/apksigning/v3

Expo, AOSP and the Google blog go beyond developer.android.com and Google support; each is the first-party owner of its claim.
