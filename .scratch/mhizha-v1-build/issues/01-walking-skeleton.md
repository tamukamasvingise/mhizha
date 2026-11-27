# 01: Walking skeleton

**What to build:** The Mhizha app opens on a phone with its shell: four bottom tabs (Home, Customers, Documents, Money), one New button, the Settings gear beside the Mhizha mark, and an empty screen on each tab that says what to do next. Light and dark follow the phone. Every push runs the tests and builds a `.test` APK. Spec sections 2 and 3. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Expo SDK 58 + TypeScript app with pnpm; package `io.github.tamukamasvingise.mhizha.test`, minSdk 29
- [ ] GitHub Actions runs Vitest and builds a `.test` APK (arm64-v8a, armeabi-v7a, x86_64) signed with the test key on every push
- [ ] The emulator job installs the APK on Android 10 (2 GB) and current, and checks it launches to Home
- [ ] The design tokens from Main screens prototype become the app's `DESIGN-SYSTEM.md`; one orange accent on greys
- [ ] Every screen passes the ui-standards bar in light and dark at the baseline 720p size
