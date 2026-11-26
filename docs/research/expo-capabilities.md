# Expo capabilities and build limits

Checked 25 November 2026 against Expo SDK 58. Read from documentation and source; nothing was built or run.

## Answer

- Every feature asked about is available free in SDK 58 for Android. All work offline except `expo-background-task`, which needs a network, and WhatsApp itself.
- **Expo's Free plan may not cover this app.** Its policy limits free use by commercial projects (see Builds). The technical limits are not the problem.
- GitHub Actions can build the APK free from a private repo, without Expo's cloud (documented, not test-built).

Recommendation: make plain Gradle on GitHub Actions the main build route, and use Expo cloud builds only for the proof of concept unless Expo confirms the project qualifies. This changes the map's current order, so the owner must decide.

## Verified: features

"Expo Go" means the docs list the package as included in Expo Go.

| Need | Support and limits | Expo Go |
|---|---|---|
| SQLite | `expo-sqlite`; data persists across restarts [1] | Yes |
| Migrations | Documented pattern: `PRAGMA user_version` in `onInit`. You write the steps; add your own transactions [1] | Yes |
| Database encryption | SQLCipher, `useSQLCipher: true`, then `PRAGMA key`. A build without SQLCipher silently stores **unencrypted** data; query `PRAGMA cipher_version` first [1] | No |
| Biometric or phone PIN | `expo-local-authentication`; falls back to the device passcode by default. With no screen lock set it returns `not_enrolled` [2][3] | Yes |
| Key storage | `expo-secure-store`; lost on uninstall, and cannot be decrypted after an Android Auto Backup restore [4] | Yes, but `requireAuthentication` is not when biometrics are available |
| Scheduled local notifications | `expo-notifications`; needs notification permission on Android 13+, and listens for reboot to restore schedules [5][6] | Yes (local only; push is not) |
| Contacts import | `expo-contacts`; `Contact.presentPicker()` picks one person. The package adds read and write contacts permissions [7] | Yes |
| Dialler | `Linking.openURL('tel:...')` [8] | Yes (inferred: core API) |
| WhatsApp | `https://wa.me/<number>?text=...`; international number, no plus, leading zeroes or punctuation [9]. Opening a URL with `startActivity` needs no `<queries>` entry [10] | Yes (inferred: ordinary link) |
| Background tasks | `expo-background-task` on WorkManager, 15-minute minimum, inexact [11] | Yes |

Consequences:

- **Reminders.** Use scheduled notifications, not background tasks. Without exact-alarm permission they arrive at an approximate time. Android 14+ denies that permission by default on new installs [5]. Android says inexact `set()` and `setAndAllowWhileIdle()` alarms fire within an hour on Android 12+, unless battery saver or Doze interferes [12]. That suits a follow-up date, so do not request exact alarms. Some manufacturers delay alarms further [5].
- **Backup.** Background tasks need enough battery and a network, stop if the user kills the app, and vary by manufacturer [11]. The source sets `NetworkType.CONNECTED` [13]. Automatic backup is best effort: also try when the app opens, and show the last success date.
- **Encryption.** A random SQLCipher key kept only in SecureStore would be lost with the phone, so portable backups need their own password-derived key. Keys stored with `requireAuthentication` become unreadable when a fingerprint is added [4]; do not protect the only database key that way.
- **Auto Backup.** `allowBackup` defaults to true and can copy app data to the user's Google Drive [14]. Set it explicitly. An encrypted database restored without its SecureStore key will not open (inferred from [1] and [4]).
- **Contacts.** Import is optional, so keep the app usable if permission is denied. Unwanted library permissions can be removed with `android.blockedPermissions` [15].

## Verified: Android version and build type

- SDK 58: minimum Android **7**, `compileSdkVersion` 37, `targetSdkVersion` 36 [16]. The map's Android 10 floor fits. To enforce it, set `minSdkVersion` 29 with `expo-build-properties` [17].
- From the list asked about, only SQLCipher strictly needs a development build (or any custom native build). Changes to config plugins, permissions and the manifest also need a new native build.
- Expo calls Expo Go "a learning environment and sandbox for getting started" [18]. Use a development build for real testing.
- Development builds load JavaScript from a development server [19], so JavaScript-only changes do not use up cloud builds. The app handed to the user must be a release APK.

## Verified: builds

### Expo cloud builds, Free plan

| Limit | Value |
|---|---|
| Android builds | **15 a month** (15 iOS separately) [20] |
| Priority and timeout | Low priority queue; 45 minutes per build [20] |
| CI/CD Workflows | 60 minutes a month [20] |
| Over quota | No charge; new builds blocked until the first of next month [21] |
| Output | APK via `distribution: internal` or `android.buildType: apk`; the default AAB cannot be installed directly [22] |

**Policy blocker.** The acceptable use policy (updated 2 November 2026) restricts the Free plan to "pre-revenue startups, proof of concepts, and hobby and student projects". It says "All commercial projects with >$1,500 USD in monthly revenue are required to be on a paid plan", and that Expo may change or discontinue the plan [23]. Its commercial examples include apps that request and process payment, or advertise a product or service. The cheapest paid plan is Starter, $19 a month plus usage [20]. The policy does not say whether a private, in-house client app counts, or whose revenue is measured.

### GitHub Actions, private repo

- GitHub Free includes **$12 of compute a month** (now stated as money, not minutes), 500 MB of artifact storage and 10 GB of cache per repo. Linux 2-core x64 costs $0.006 a minute [24], so $12 is **2,000 minutes** (calculated). At an illustrative 20 to 40 minutes a build, that is 50 to 100 builds. The allowance belongs to the account, so all its private repos share it.
- Without a payment method on file, use is blocked when the allowance ends [24], so there is no overage bill. With one on file, check the budget.
- Private-repo Linux runners have 2 CPUs, 8 GB RAM and 14 GB SSD [25]; a job may run 6 hours [26]. The Ubuntu 24.04 image includes Java 17 (default), Android build-tools 37.0.0, SDK platform 37.0 and NDK 27.3 [27]. React Native 0.88 asks for compile SDK 37, build-tools 37.0.0 and NDK 27.1.12297006 [28], so that exact NDK is not the preinstalled one.
- Two routes:
  1. `expo prebuild`, then `./gradlew :app:assembleRelease`. Independent of Expo's cloud. The stock template signs release builds with the **debug key** [29], so signing must be configured (for example by a config plugin), with the keystore in GitHub secrets.
  2. `eas build --platform android --local`. Still needs an Expo login or `EXPO_TOKEN` and contacts Expo to check the project [30]. Less independent, and the Free plan policy may still apply.
- Uploaded APK artifacts use the 500 MB, so set short retention or delete them.

### This PC

Expo lists Windows as able to compile Android apps locally [19], but does not support `eas build --local` on Windows [30]. Android Studio alone asks for at least 8 GB RAM; with the emulator, 16 GB [31]. On this 8 GB PC local Gradle is a last resort, and a real phone should replace the emulator.

### Signing

Android compares the new certificate with the installed app's on update; outside Play App Signing, a lost key means the app cannot be updated [32]. Generate **one keystore yourself**, keep offline copies, and use it on both build routes. If Expo generated it, download it with `eas credentials` first [33]. Never commit it.

### Side finding: Android developer verification

From 30 September 2026 Google restricts installs from participating stores in Brazil, Indonesia, Singapore and Thailand; it plans to expand to all apps on certified devices globally in 2027 [34]. This could affect a sideloaded APK. A limited distribution account is free and needs no government ID, but it is for students and hobbyists, requires a package name never seen before on Android, and authorises devices one by one. The help centre says up to 50 devices [35]; Google's overview says 20 [34]. Whether a commercial client app qualifies needs its own check before the package is distributed.

## Unverified or unknown

- Whether Expo's policy allows this app on the Free plan. Only Expo can answer; no contact was made.
- Actual Gradle time, memory use and success on a 2-core, 8 GB runner. Building only the phone's CPU type may help.
- Fingerprint and PIN behaviour on Android 10. The SDK uses a different credential fallback below Android 11 [3].
- Reminder and background reliability on the actual phone.
- SQLCipher performance, restore, and upgrades with `user_version`. Its licence text was not checked.
- Whether `presentPicker()` asks for contacts permission at runtime.
- Expo Go for SDK 58: the release note said store versions were weeks away [36]; the install page now offers SDK 58 [18]. Not installed.
- When, and for which accounts, developer verification reaches Zimbabwe.
- Google Drive backup (not part of this question).

## Prove first in the test app

1. GitHub Actions release APK, signed with the permanent key, installed on the phone, then updated with data intact.
2. `PRAGMA cipher_version` returns a row; a version 1 to 2 migration keeps data.
3. Lock with fingerprint, with PIN, and with no screen lock set.
4. A reminder after a reboot and an overnight idle.
5. Start and use in airplane mode.

## Sources

1. https://docs.expo.dev/versions/latest/sdk/sqlite/
2. https://docs.expo.dev/versions/latest/sdk/local-authentication/
3. https://github.com/expo/expo/blob/sdk-58/packages/expo-local-authentication/android/src/main/java/expo/modules/localauthentication/LocalAuthenticationModule.kt
4. https://docs.expo.dev/versions/latest/sdk/securestore/
5. https://docs.expo.dev/versions/latest/sdk/notifications/
6. https://github.com/expo/expo/blob/sdk-58/packages/expo-notifications/android/src/main/AndroidManifest.xml
7. https://docs.expo.dev/versions/latest/sdk/contacts/
8. https://docs.expo.dev/linking/into-other-apps/ and https://docs.expo.dev/versions/latest/sdk/linking/
9. https://faq.whatsapp.com/5913398998672934
10. https://developer.android.com/training/package-visibility/use-cases
11. https://docs.expo.dev/versions/latest/sdk/background-task/
12. https://developer.android.com/develop/background-work/services/alarms
13. https://github.com/expo/expo/blob/sdk-58/packages/expo-background-task/android/src/main/java/expo/modules/backgroundtask/BackgroundTaskScheduler.kt
14. https://docs.expo.dev/versions/latest/config/app/#allowbackup
15. https://docs.expo.dev/guides/permissions/
16. https://docs.expo.dev/versions/latest/
17. https://docs.expo.dev/versions/latest/sdk/build-properties/
18. https://expo.dev/go
19. https://docs.expo.dev/develop/development-builds/introduction/
20. https://expo.dev/pricing
21. https://docs.expo.dev/billing/faq/
22. https://docs.expo.dev/build-reference/apk/
23. https://expo.dev/acceptable-use#free-plan
24. https://docs.github.com/en/billing/concepts/product-billing/github-actions
25. https://docs.github.com/en/actions/reference/runners/github-hosted-runners
26. https://docs.github.com/en/actions/reference/limits
27. https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md
28. https://github.com/facebook/react-native/blob/0.88-stable/packages/react-native/gradle/libs.versions.toml
29. https://github.com/expo/expo/blob/sdk-58/templates/expo-template-bare-minimum/android/app/build.gradle
30. https://docs.expo.dev/build-reference/local-builds/
31. https://developer.android.com/studio/install
32. https://developer.android.com/studio/publish/app-signing
33. https://docs.expo.dev/guides/local-app-production/
34. https://developer.android.com/developer-verification
35. https://support.google.com/android-developer-console/answer/17131204
36. https://expo.dev/changelog/sdk-58
