#!/usr/bin/env bash
# PROTOTYPE, throwaway: builds the Install and update proof APKs on GitHub Actions.
# Makes a fresh Expo app, lays the proof files over it, then builds:
#   proof-v1.apk            version code 1, upgrade step 1
#   proof-v2.apk            version code 2, adds upgrade step 2
#   proof-v3.apk            version code 3, adds a step that fails on purpose
#   proof-v2-other-key.apk  build 2 signed with a different key (must be refused)
# The test key is made here for each run and never kept or uploaded.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/out}"
WORK="${RUNNER_TEMP:-/tmp}/proof-app"
KEYS="${RUNNER_TEMP:-/tmp}/proof-keys"
ARCHS="x86_64,armeabi-v7a,arm64-v8a"
TIMINGS="$OUT/build-timings.md"

mkdir -p "$OUT" "$KEYS"
rm -rf "$WORK"
echo "| Build step | Seconds |" > "$TIMINGS"
echo "|---|---|" >> "$TIMINGS"
timed() { local name="$1"; shift; local s; s=$(date +%s); "$@"; echo "| $name | $(( $(date +%s) - s )) |" >> "$TIMINGS"; }

cd "$(dirname "$WORK")"
timed "create Expo app" pnpm dlx create-expo-app@latest proof-app --template blank-typescript --no-install
cd "$WORK"
printf 'node-linker=hoisted\n' > .npmrc
rm -f app.json
cp "$HERE/app/App.tsx" "$HERE/app/app.config.js" .
timed "pnpm install" pnpm install
timed "add Expo modules" pnpm expo install expo-sqlite expo-print expo-crypto expo-file-system expo-build-properties
cp package.json "$OUT/package.json"

BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
mkkey() { keytool -genkeypair -keystore "$KEYS/$1.keystore" -storepass proofpass -keypass proofpass \
  -alias proof -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mhizha proof $1" >/dev/null 2>&1; }
mkkey test
mkkey other
sign() { "$BT/apksigner" sign --ks "$KEYS/$1.keystore" --ks-pass pass:proofpass --ks-key-alias proof --out "$3" "$2"; }

for v in 1 2 3; do
  echo "export const BUILD = $v;" > proof-version.ts
  export PROOF_VERSION=$v
  timed "prebuild v$v" pnpm expo prebuild --platform android --clean --no-install
  timed "gradle v$v" bash -c "cd android && ./gradlew assembleRelease -PreactNativeArchitectures=$ARCHS --no-daemon"
  APK=android/app/build/outputs/apk/release/app-release.apk
  sign test "$APK" "$OUT/proof-v$v.apk"
  if [ "$v" = 2 ]; then sign other "$APK" "$OUT/proof-v2-other-key.apk"; fi
done

ls -l "$OUT"/*.apk
