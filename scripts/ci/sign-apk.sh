#!/usr/bin/env bash
# Signs a `.test` APK with the test key. Usage: sign-apk.sh <in.apk> <out.apk>
# Uses the keystore from the MHIZHA_TEST_* secrets when set (see ci.yml);
# otherwise makes a throwaway key for this run only. Never writes a key into
# the repo: keys live in $RUNNER_TEMP and die with the runner.
set -euo pipefail

IN="$1"
OUT="$2"
KEYS="${RUNNER_TEMP:-$(mktemp -d)}/test-keys"
mkdir -p "$KEYS"
KS="$KEYS/test.keystore"

if [ -n "${MHIZHA_TEST_KEYSTORE_BASE64:-}" ]; then
  echo "Signing with the test keystore from repo secrets."
  printf '%s' "$MHIZHA_TEST_KEYSTORE_BASE64" | base64 -d > "$KS"
  STORE_PASS="${MHIZHA_TEST_KEYSTORE_PASSWORD:?MHIZHA_TEST_KEYSTORE_PASSWORD is not set}"
  ALIAS="${MHIZHA_TEST_KEY_ALIAS:?MHIZHA_TEST_KEY_ALIAS is not set}"
  KEY_PASS="${MHIZHA_TEST_KEY_PASSWORD:-$STORE_PASS}"
else
  echo "::warning::No test keystore secret: signing with a throwaway key. This APK cannot install over a .test build from another run."
  STORE_PASS="$(openssl rand -hex 16)"
  KEY_PASS="$STORE_PASS"
  ALIAS=throwaway
  keytool -genkeypair -keystore "$KS" -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
    -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mhizha throwaway test key" >/dev/null
fi

BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
"$BT/zipalign" -f -p 4 "$IN" "$KEYS/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$STORE_PASS" --ks-key-alias "$ALIAS" \
  --key-pass "pass:$KEY_PASS" --out "$OUT" "$KEYS/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" | grep -v -i 'sha-1'
rm -f "$KS" "$KEYS/aligned.apk"
ls -l "$OUT"
