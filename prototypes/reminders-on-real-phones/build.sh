#!/usr/bin/env bash
# PROTOTYPE, throwaway: builds the Reminders test APK on GitHub Actions.
# Makes a fresh Expo app, lays the test files over it, builds for 64-bit arm
# (the owner's Galaxy S22 Ultra) and x86_64, and signs with a key made for this run only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/out}"
WORK="${RUNNER_TEMP:-/tmp}/reminders-app"
KEYS="${RUNNER_TEMP:-/tmp}/reminders-keys"

mkdir -p "$OUT" "$KEYS"
rm -rf "$WORK"
cd "$(dirname "$WORK")"
pnpm dlx create-expo-app@latest reminders-app --template blank-typescript --no-install
cd "$WORK"
printf 'node-linker=hoisted\n' > .npmrc
rm -f app.json
cp "$HERE/app/App.tsx" "$HERE/app/app.config.js" .
pnpm install
pnpm expo install expo-notifications expo-build-properties
cp package.json "$OUT/package.json"

pnpm expo prebuild --platform android --clean --no-install
grep -o 'android.permission.[A-Z_]*' android/app/src/main/AndroidManifest.xml | sort -u > "$OUT/permissions.txt" || true
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --no-daemon)

BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
keytool -genkeypair -keystore "$KEYS/test.keystore" -storepass testpass -keypass testpass \
  -alias test -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mhizha reminders test" >/dev/null 2>&1
"$BT/apksigner" sign --ks "$KEYS/test.keystore" --ks-pass pass:testpass --ks-key-alias test \
  --out "$OUT/reminders-test.apk" android/app/build/outputs/apk/release/app-release.apk
ls -l "$OUT"
