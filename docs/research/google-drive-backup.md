# Automatic Google Drive backup

Checked 2026-11-25 against first-party docs and source. Most pages were read through a page-to-text tool that may summarise, so wording was not compared with raw HTML. Nothing was run on a phone or in a Google Cloud project. **Inference** means reasoned from sources, not stated by them.

## Answer

- **Free:** yes. Drive API standard-tier use is free ([limits](https://developers.google.com/workspace/drive/api/guides/limits)); files use the account's 15 GB shared allowance ([storage](https://support.google.com/drive/answer/9312312)).
- **Fully automatic:** after one consent, normally yes, but never guaranteed or at an exact time. Android and phone makers delay background work. The app must show the last successful backup and retry when opened.
- **Password:** yes, if the app encrypts the file before uploading. None of the options found gives a per-app backup password.

**Recommendation: Drive API with `drive.file`**, app-encrypted files in a visible "Mhizha backups" folder, and a manual export/import as fallback. Use an External OAuth project published **In production**, not Testing, if the console allows it without a domain (unverified 1). Use Auto Backup at most as a second safety net. Do not build on a Storage Access Framework (SAF) Drive folder.

## Comparison

| | Drive API `drive.file` | Drive API `drive.appdata` | Android Auto Backup | SAF folder |
|---|---|---|---|---|
| Size | 15 GB account; 5 TB per file | Same | 25 MB per app, latest copy only | Provider's limit |
| OAuth / consent | Yes, once | Yes, once | None | None; folder picker |
| Scope verification | Not mandatory | Not mandatory | n/a | n/a |
| Automatic | Yes, best effort | Yes, best effort | Yes, system controlled | Local folder only, best effort |
| Outside Play | Yes (inference) | Yes (inference) | Yes; restore has conditions | Yes |
| New phone | Sign in, pick file, password (test) | Same | Via phone setup only | Copy the file yourself |
| Password | App-made encryption | App-made encryption | Screen lock, or encrypt file first | App-made encryption |
| User can see file | Yes | No | No | Yes |

## Verified facts

### Drive API: scopes and storage

- `drive.file` and `drive.appdata` are both **non-sensitive**, the lightest class ([scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)). Non-sensitive scopes do not make app verification mandatory; brand verification is for showing name and logo ([verification](https://support.google.com/cloud/answer/13463073)).
- `drive.appdata` is hidden from the user and other apps. It is deleted if the user uninstalls the app from My Drive, and can be deleted manually ([app data](https://developers.google.com/workspace/drive/api/guides/appdata)). Hidden app data counts towards storage ([storage](https://support.google.com/drive/answer/9312312)).
- Upload: simple or multipart up to 5 MB; resumable for larger, with a session that lasts one week ([uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)). 750 GB a day, 5 TB per file ([limits](https://developers.google.com/workspace/drive/api/guides/limits)).

### OAuth client and consent screen, no domain

- An Android OAuth client needs the package name and SHA-1 of the signing certificate; Google documents self-managed keys, not just Play signing. "Verify app ownership" is optional and Play-only ([Android authorization](https://developer.android.com/identity/authorization)). Fingerprint commands: [client auth](https://developers.google.com/android/guides/client-auth). A test build signed with another key therefore needs its own client (inference).
- Browser sign-in with a custom URI scheme is no longer supported on Android; loopback is deprecated too ([native apps](https://developers.google.com/identity/protocols/oauth2/native-app)). Use the Play services API.

| User type / status | Who | Expiry | Verification |
|---|---|---|---|
| External, Testing | Up to 100 listed testers | **7 days** for Drive scopes | Exempt |
| External, In production | Any Google account | 7-day rule is stated for Testing only | Not mandatory for these scopes; name/logo need brand verification |
| Personal | Only the account that created the project | Exempt from 7 days | Exempt; type can never be changed |

Source: [audience](https://support.google.com/cloud/answer/15549945), except the non-sensitive rule above. The 100-user lifetime cap applies to unapproved sensitive or restricted scopes, not these.

- **Domain:** brand verification needs a verified owned domain and public homepage ([brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)). The branding page says homepage and privacy links are "required for all external production apps", and that unverified apps do not show name and logo ([branding](https://support.google.com/cloud/answer/15549049)). But the policy does not class an app used by fewer than 100 people known personally to you as "production" ([policies](https://developers.google.com/identity/protocols/oauth2/policies)), and apps for fewer than 100 users may skip verification ([exceptions](https://support.google.com/cloud/answer/13464323)). These pull different ways about the links; see unverified 1.

### Tokens

- Access tokens last one hour. After one consent, calling `AuthorizationClient.authorize()` returns new ones without interaction until the grant is removed. The app needs no refresh token or server; Google warns against keeping refresh tokens on the device ([Android authorization](https://developer.android.com/identity/authorization)).
- There is a `Context` overload as well as `Activity` ([Identity](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/Identity)). If consent is needed again, a PendingIntent is returned, so a background run must stop and ask the user later (inference). Without Play services it fails ([AuthorizationClient](https://developers.google.com/android/reference/com/google/android/gms/auth/api/identity/AuthorizationClient)).
- Refresh tokens can die after six months unused, revocation, or seven days in Testing ([OAuth](https://developers.google.com/identity/protocols/oauth2)). OAuth **clients** unused for six months are deleted: 30-day email warning, usually restorable for 30 days ([clients](https://support.google.com/cloud/answer/15549257)).

### Background reliability

- Expo Background Task uses WorkManager: minimum 15 minutes, default 12 hours, and the interval is only a minimum. Needs network and enough battery. Stops if the user kills the app (until reopened), resumes after reboot; removing from recents does not completely stop it, and vendors vary ([Expo](https://docs.expo.dev/versions/latest/sdk/background-task/)). Expo's current source uses chained one-time work with a connected-network constraint ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-background-task/android/src/main/java/expo/modules/backgroundtask/BackgroundTaskScheduler.kt)).
- WorkManager gives work at most ten minutes ([WorkManager](https://developer.android.com/reference/androidx/work/package-summary)). On Android 13+, an app untouched for 8 days can enter the restricted bucket: jobs once a day, in a shared batch. The user's "unrestricted" setting exempts it ([standby](https://developer.android.com/topic/performance/appstandby)).
- Expo lists two Google sign-in libraries, both needing a development build ([Expo Google](https://docs.expo.dev/guides/google-authentication/)).

### Android Auto Backup

Unless noted, from [Auto Backup](https://developer.android.com/identity/data/autobackup).

- 25 MB; above it nothing goes to the cloud. Only the latest backup is kept. Runs about nightly: 24 h elapsed, idle, Wi-Fi unless mobile-data backup is allowed. May never run.
- End-to-end encrypted on Android 9+ with the device PIN, pattern or password. `disableIfNoEncryptionCapabilities` (12+) or `requireFlags="clientSideEncryption"` (9 to 11) can require it. No separate app password is documented.
- Restores at install, including adb install, before first launch. A new phone restores an old phone's data **only if that backup was chosen in the setup wizard**; otherwise it restores its own backups only.
- AOSP skips restore if signing certificates differ, or if the backup is from a newer version of the app (unless `restoreAnyVersion`) ([source](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/backup/java/com/android/server/backup/utils/TarBackupReader.java)). A backup from a newer Android cannot restore to an older one ([help](https://support.google.com/android/answer/2819582)).
- Expo leaves it on by default through `android.allowBackup` ([config](https://docs.expo.dev/versions/latest/config/app/)). So **doing nothing is a choice**: records could go into Google's backup without the app's password. SecureStore data is excluded by default, unless custom backup rules are used ([SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)).
- Docs conflict on quota: Android says it does not count; Drive help says device backups do ([storage](https://support.google.com/drive/answer/9312312)).

### Storage Access Framework

- The user picks a directory once; access can persist over reboots but is lost if it is moved or deleted. Files survive uninstall. Android 11+ blocks the storage root and `Download`. Providers differ in the operations they support ([SAF](https://developer.android.com/training/data-storage/shared/documents-files)). Expo takes the persistable permission ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/FilePickerContract.kt)).
- No Google source was found saying the Drive app offers folders to the directory picker. Saving one file through "Create document" is user-driven, so it is a manual export only. Android advises against backing up URIs ([overview](https://developer.android.com/guide/topics/data/backup)), so choose the folder again on a new phone (inference).

### Password encryption

- `expo-crypto` offers AES-GCM and key import, but documents no password key derivation ([Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/)). Android provides PBKDF2withHmacSHA256 from API 26, below our Android 10 floor ([SecretKeyFactory](https://developer.android.com/reference/javax/crypto/SecretKeyFactory)), so a small native module can derive the key (inference).
- `expo-sqlite` can copy a database with `backupDatabaseAsync` ([Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)).

## Suggested design (inference)

1. At setup: choose a password, connect Google. Derive a key with a random salt; keep the key in SecureStore **without** `requireAuthentication` (it would block background runs). Never store the password.
2. A due backup copies the database, packs it with PDFs, and encrypts it. File header: version, salt, KDF settings, unique nonce. Nothing readable is uploaded.
3. Trigger on app open when changed, after issuing a Document, and daily in background. Resumable upload; confirm before pruning; keep several dated versions, since a single overwritten file can spread damage.
4. Show "last backed up", warn when overdue, and ask to reconnect if consent is gone.
5. New phone: install, connect the same Google account, choose a backup, enter password. If OAuth breaks, download the visible file from Drive and open it with the import picker.
6. **Forgotten password means the backup is lost.** A written recovery copy is a product decision.
7. Prefer `drive.file` over `drive.appdata`: the copy is visible and can be downloaded without the app, and it is an ordinary Drive file, so the app-data deletion rule does not cover it. Trade-off: the user can delete it.
8. Keep one signing key for life and copy it safely. Losing it breaks updates, the OAuth client match and Auto Backup restore.
9. Set `allowBackup` deliberately. Safest default: off, so all cloud copies are password-protected. On some makers' phones that does not stop device-to-device transfer on Android 12+ ([Auto Backup](https://developer.android.com/identity/data/autobackup)).

## Unverified: test or decide

1. Does Google Cloud console let an External app with no homepage/domain be published In production, and what does its consent screen show? This is the main risk. Fallback: a Personal-mode project owned by the Google account on the phone. Limits: that account only, and permanent. Whether one package + SHA-1 can also be in another project was not found.
2. Silent token from a background task after process death, on real phones, over more than 7 days. A Nitro sign-in [pull request](https://github.com/react-native-nitro-google-sign-in/google-signin/pull/71) claims tokens without an Activity (seen in search results only; release state not checked). Otherwise a small native Expo module is needed.
3. Does a reinstalled app on a second phone list its earlier `drive.file` files with the same OAuth project? Expected, but not stated in sources read.
4. Does the Drive app appear in the directory picker on target phones?
5. Auto Backup restore when an APK is opened from a file manager (docs say any install; named examples are Play, setup and adb).
6. Phone model, battery rules, presence of Play services, mobile-data cost, free Drive space, and expected PDF volume.

Related risk for installing the app at all: Android developer verification began for certain countries and stores on 2026-09-30, and expands globally in 2027 ([timeline](https://developer.android.com/developer-verification)). The free limited-distribution account is described for hobbyists and learners, "no commercial intent" for hobbyists ([limited](https://developer.android.com/developer-verification/guides/limited-distribution)). This belongs in an install/update ticket.
