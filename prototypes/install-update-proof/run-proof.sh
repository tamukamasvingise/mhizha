#!/usr/bin/env bash
# PROTOTYPE, throwaway: drives the Install and update proof on a running emulator.
# Usage: run-proof.sh <folder with APKs> <results folder>
# Writes summary.md (pass or fail per check, timings), one JSON report and one
# screenshot per launch. Exits non-zero if any check fails.
set -uo pipefail

APKS="$1"
OUT="$2"
PKG=io.github.tamukamasvingise.mhizha.test
mkdir -p "$OUT"
SUMMARY="$OUT/summary.md"
TIMES="$OUT/timings.tmp"
FAILED=0
: > "$TIMES"

now() { date +%s%3N; }
note() { echo "$1" >> "$SUMMARY"; }
pass() { note "- PASS: $1"; }
fail() { note "- **FAIL: $1**"; FAILED=1; }
time_row() { echo "| $1 | $2 |" >> "$TIMES"; }

# check "<description>" <report name> '<jq expression that must be true>'
check() {
  if jq -e "$3" "$OUT/$2.json" >/dev/null 2>&1; then pass "$1"; else fail "$1 (got: $(jq -c . "$OUT/$2.json" 2>/dev/null | head -c 400))"; fi
}

install_apk() { # name, apk, extra adb args; sets INSTALL_OUT and INSTALL_OK
  local t0 t1
  t0=$(now)
  INSTALL_OUT=$(adb install $3 "$APKS/$2" 2>&1)
  INSTALL_OK=$?
  t1=$(now)
  echo "$INSTALL_OUT" > "$OUT/$1-install.txt"
  time_row "$1" "$((t1 - t0)) ms"
}

launch() { # name: start the app, wait for its report, screenshot it
  local name="$1" t0 t1 line=""
  adb shell am force-stop "$PKG"
  adb logcat -c
  t0=$(now)
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  for _ in $(seq 1 180); do
    line=$(adb logcat -d -s ReactNativeJS:V | grep -o 'PROOF_RESULT .*' | tail -1)
    [ -n "$line" ] && break
    sleep 1
  done
  t1=$(now)
  line="${line#PROOF_RESULT }"
  line="${line%\'}"
  [ -n "$line" ] || line='{"noReport":true}'
  echo "$line" > "$OUT/$name.json"
  adb logcat -d > "$OUT/$name-logcat.txt"
  sleep 2
  adb exec-out screencap -p > "$OUT/$name.png"
  time_row "$name: open to report" "$((t1 - t0)) ms"
}

version_code() { adb shell dumpsys package "$PKG" | grep -o 'versionCode=[0-9]*' | head -1 | cut -d= -f2; }
first_install() { adb shell dumpsys package "$PKG" | grep -o 'firstInstallTime=.*' | head -1 | tr -d '\r'; }

echo "# Install and update proof" > "$SUMMARY"
note ""
note "Emulator: Android $(adb shell getprop ro.build.version.release | tr -d '\r'), API $(adb shell getprop ro.build.version.sdk | tr -d '\r'), $(adb shell getprop ro.product.cpu.abi | tr -d '\r'), $(adb shell wm size | tr -d '\r' | sed 's/Physical size: //'), $(adb shell grep MemTotal /proc/meminfo | tr -d '\r' | tr -s ' ')"
note ""
note "APK sizes: $(cd "$APKS" && ls -l proof-v*.apk | awk '{printf "%s %.1f MB; ", $9, $5/1048576}')"
note ""
note "## Checks"
note ""

adb uninstall "$PKG" >/dev/null 2>&1 || true

# 1. Fresh install of build 1, first open saves a record and a PDF.
install_apk "install v1" proof-v1.apk ""
[ $INSTALL_OK -eq 0 ] && pass "build 1 installs" || fail "build 1 installs: $INSTALL_OUT"
FIRST=$(first_install)
launch v1-first-open
check "first open saves one Customer, one Document and one PDF record" v1-first-open '.seeded == true and .counts == {"customer":1,"document":1,"file":1}'
check "the PDF file exists and matches its checksum" v1-first-open '.pdf.exists and .pdf.shaMatches and .pdf.sizeMatches'
check "database is at version 1, no safety copy on a new install" v1-first-open '.dbVersionAfter == 1 and .safetyCopyMade == false'

launch v1-reopen
check "reopening keeps the records and saves nothing new" v1-reopen '.seeded == false and .counts == {"customer":1,"document":1,"file":1}'

# 2. An update signed with another key must be refused.
install_apk "install v2, other key" proof-v2-other-key.apk "-r"
if [ $INSTALL_OK -ne 0 ] && echo "$INSTALL_OUT" | grep -q INSTALL_FAILED_UPDATE_INCOMPATIBLE; then
  pass "an update signed with another key is refused"
else
  fail "an update signed with another key is refused: $INSTALL_OUT"
fi

# 3. Install build 2 over build 1.
install_apk "install v2 over v1" proof-v2.apk "-r"
[ $INSTALL_OK -eq 0 ] && pass "build 2 installs over build 1" || fail "build 2 installs over build 1: $INSTALL_OUT"
[ "$(version_code)" = 2 ] && pass "version code is now 2" || fail "version code is now 2 (got $(version_code))"
[ "$(first_install)" = "$FIRST" ] && pass "same install: first install time unchanged" || fail "first install time changed: $FIRST vs $(first_install)"
launch v2-first-open
check "first open after update copies the database before upgrading" v2-first-open '.dbVersionBefore == 1 and .safetyCopyMade == true and .safetyCopyVersion == 1 and .safetyCopyCustomers == 1'
check "upgrade step 2 runs and the database is at version 2" v2-first-open '.dbVersionAfter == 2 and .hasWhatsappColumn == true and .upgradeError == null'
check "every record survives the update" v2-first-open '.seeded == false and .counts == {"customer":1,"document":1,"file":1}'
check "the PDF survives the update unchanged" v2-first-open '.pdf.exists and .pdf.shaMatches and .pdf.sizeMatches'
check "the upgrade log shows step 2 once" v2-first-open '([.upgradeLog[] | select(.to_version == 2 and .result == "ok")] | length) == 1'

launch v2-reopen
check "step 2 does not run again on the next open" v2-reopen '.safetyCopyMade == false and ([.upgradeLog[] | select(.to_version == 2)] | length) == 1'

# 4. Build 3 has an upgrade step that fails: the app must return to the copy.
install_apk "install v3 over v2" proof-v3.apk "-r"
[ $INSTALL_OK -eq 0 ] && pass "build 3 installs over build 2" || fail "build 3 installs over build 2: $INSTALL_OUT"
launch v3-failed-upgrade
check "a failing step is reported and the app returns to the copy" v3-failed-upgrade '.upgradeError != null and .restoredCopy == true and .dbVersionAfter == 2'
check "after the failed upgrade every record and the PDF are intact" v3-failed-upgrade '.counts == {"customer":1,"document":1,"file":1} and .pdf.shaMatches'
check "the upgrade log records the failure" v3-failed-upgrade '([.upgradeLog[] | select(.to_version == 3 and (.result | startswith("failed")))] | length) == 1'

# 5. Going back to an older version code must be refused.
install_apk "install v1 over v3" proof-v1.apk "-r"
if [ $INSTALL_OK -ne 0 ] && echo "$INSTALL_OUT" | grep -q INSTALL_FAILED_VERSION_DOWNGRADE; then
  pass "installing an older version over a newer one is refused"
else
  fail "installing an older version over a newer one is refused: $INSTALL_OUT"
fi

note ""
note "## Timings"
note ""
note "| Step | Time |"
note "|---|---|"
cat "$TIMES" >> "$SUMMARY"
rm -f "$TIMES"

cat "$SUMMARY"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$SUMMARY" >> "$GITHUB_STEP_SUMMARY"
exit $FAILED
