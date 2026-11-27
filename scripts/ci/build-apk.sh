#!/usr/bin/env bash
# Builds the unsigned-for-us `.test` release APK (the template signs it with the
# debug key; sign-apk.sh re-signs it). Usage: build-apk.sh <output folder>
# Test builds carry x86_64 for the emulator besides the two phone ABIs.
set -euo pipefail

OUT="$1"
ABIS="${MHIZHA_ABIS:-arm64-v8a,armeabi-v7a,x86_64}"
mkdir -p "$OUT"

pnpm expo prebuild --platform android --clean --no-install
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$ABIS" --no-daemon)

cp android/app/build/outputs/apk/release/app-release.apk "$OUT/unsigned.apk"

echo "Permissions in the APK manifest:"
grep -o 'android.permission.[A-Z_]*' android/app/src/main/AndroidManifest.xml | sort -u || true
ls -l "$OUT"
