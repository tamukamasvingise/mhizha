#!/usr/bin/env bash
# Installs the `.test` APK on a running emulator, checks it opens on Home with
# the shell in place, in light and dark, opens the Price list, shows the problem screen, runs the
# database checks on the real expo-sqlite, and screenshots every screen for the
# UI review. Usage: launch-check.sh <apk> <results folder>
# Exits non-zero if any check fails; summary.md says which.
set -uo pipefail

APK="$1"
OUT="$2"
PKG=io.github.tamukamasvingise.mhizha.test
mkdir -p "$OUT"
SUMMARY="$OUT/summary.md"
FAILED=0

note() { echo "$1" | tee -a "$SUMMARY"; }
pass() { note "- PASS: $1"; }
fail() { note "- **FAIL: $1**"; FAILED=1; }

# Dump the screen's accessibility tree to $OUT/<name>.xml and screenshot it.
capture() {
  sleep 2
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1 || echo '<none/>' > "$OUT/$1.xml"
  adb exec-out screencap -p > "$OUT/$1.png"
}

# has <name> <pattern>: the dump holds a node matching the pattern.
has() { grep -q -E "$2" "$OUT/$1.xml"; }

# Wait until the screen shows the given text (up to 90 s).
wait_for() {
  for _ in $(seq 1 45); do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb shell cat /sdcard/ui.xml 2>/dev/null | grep -q "$1" && return 0
    sleep 2
  done
  return 1
}

# back_until <text> <n>: press Back one at a time until the screen shows the text (at most n presses).
back_until() {
  for _ in $(seq 1 "$2"); do
    adb shell input keyevent KEYCODE_BACK
    sleep 1
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb shell cat /sdcard/ui.xml 2>/dev/null | grep -q "$1" && return 0
  done
  return 1
}

# Tap the centre of the first node whose content-desc or text is exactly $1.
tap() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep -E "(content-desc|text)=\"$1\"" | head -1 |
    grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '[0-9]*' | tr '\n' ' ')
  # shellcheck disable=SC2086
  set -- $b
  [ $# -eq 4 ] || return 1
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

# set_night light|dark: switch the phone's dark theme. Android 10 locks the
# day/night mode against `cmd uimode`, so there the secure setting is written
# and the emulator restarted to pick it up.
set_night() {
  local yes=no val=1
  [ "$1" = dark ] && yes=yes val=2
  adb shell settings put secure ui_night_mode "$val"
  adb shell cmd uimode night "$yes" >/dev/null
  if ! adb shell cmd uimode night | grep -q "Night mode: $yes"; then
    adb reboot
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
    adb shell input keyevent KEYCODE_WAKEUP
    adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
    sleep 5
  fi
  note "  ($1: $(adb shell cmd uimode night | tr -d '\r'))"
}

# page_is <name> light|dark: the page behind the empty state has that theme's colour.
page_is() {
  local rgb r
  rgb=$(python3 -I "$(dirname "$0")/pixel.py" "$OUT/$1.png" 360 640 2>/dev/null)
  r=${rgb%% *}
  if [ -z "$r" ]; then fail "$2: page colour readable"; return; fi
  if [ "$2" = dark ] && [ "$r" -lt 64 ]; then pass "$2: page is dark ($rgb)";
  elif [ "$2" = light ] && [ "$r" -gt 192 ]; then pass "$2: page is light ($rgb)";
  else fail "$2: page colour follows the phone (got $rgb)"; fi
}

launch() {
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}

# open_link <url>: start the app afresh on one of the test build's links.
open_link() {
  adb shell am force-stop "$PKG"
  adb shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" >/dev/null 2>&1
}

echo "# Launch check" > "$SUMMARY"
note ""
note "Emulator: Android $(adb shell getprop ro.build.version.release | tr -d '\r'), API $(adb shell getprop ro.build.version.sdk | tr -d '\r'), $(adb shell wm size | tr -d '\r' | sed 's/Physical size: //'), $(adb shell grep MemTotal /proc/meminfo | tr -d '\r' | tr -s ' ')"
note "APK: $(ls -l "$APK" | awk '{printf "%.1f MB", $5/1048576}')"
note ""

adb uninstall "$PKG" >/dev/null 2>&1 || true
if INSTALL=$(adb install "$APK" 2>&1); then pass "installs"; else fail "installs: $INSTALL"; fi

for mode in light dark; do
  set_night "$mode"
  launch
  if wait_for 'Welcome to Mhizha'; then pass "$mode: opens on Home"; else fail "$mode: opens on Home (no 'Welcome to Mhizha' within 90 s)"; fi
  capture "$mode-home"
  page_is "$mode-home" "$mode"
  has "$mode-home" 'content-desc="Home"[^>]*selected="true"|selected="true"[^>]*content-desc="Home"' &&
    pass "$mode: Home tab is the current tab" || fail "$mode: Home tab is the current tab"
  for t in Customers Documents Money; do
    has "$mode-home" "content-desc=\"$t\"" && pass "$mode: $t tab is there" || fail "$mode: $t tab is there"
  done
  has "$mode-home" 'content-desc="Settings"' && pass "$mode: Settings gear is there" || fail "$mode: Settings gear is there"
  has "$mode-home" 'content-desc="New Quotation, Invoice, Payment or Customer"' &&
    pass "$mode: New button is there" || fail "$mode: New button is there"

  # Screens for the UI review.
  for t in Customers Documents Money; do
    tap "$t" && capture "$mode-$(echo "$t" | tr 'A-Z' 'a-z')" || fail "$mode: tap $t"
  done
  tap Home && tap 'New Quotation, Invoice, Payment or Customer' && capture "$mode-new" || fail "$mode: open New"
  has "$mode-new" 'Make something new' && pass "$mode: New opens its sheet" || fail "$mode: New opens its sheet"
  adb shell input keyevent KEYCODE_BACK
  tap Settings && capture "$mode-settings" || fail "$mode: open Settings"
  has "$mode-settings" 'text="Settings"' && pass "$mode: Settings opens" || fail "$mode: Settings opens"
  tap 'Price list, No items yet' && capture "$mode-prices" || fail "$mode: open the Price list"
  has "$mode-prices" 'No items yet' && pass "$mode: Price list opens, empty" || fail "$mode: Price list opens, empty"
  tap 'Add an item' && capture "$mode-price-add" || fail "$mode: open Add an item"
  tap 'Add to Price list' && capture "$mode-price-add-errors" || fail "$mode: tap Add to Price list"
  has "$mode-price-add-errors" "Enter the item's name" &&
    pass "$mode: an item with no name is refused, saying why" || fail "$mode: an item with no name is refused, saying why"
  # Back closes the keyboard (if it is up), then the sheet, then the Price list.
  back_until 'Documents and money' 4
  capture "$mode-settings-again"
  has "$mode-settings-again" 'text="Documents and money"' &&
    pass "$mode: back from the Price list returns to Settings" || fail "$mode: back from the Price list returns to Settings"
  adb shell input keyevent KEYCODE_BACK
  capture "$mode-back"
  has "$mode-back" 'Welcome to Mhizha' && pass "$mode: back from Settings returns Home" || fail "$mode: back from Settings returns Home"

  # The problem screen, through the test build's link.
  open_link 'mhizha-test://self-test/error'
  if wait_for 'Your records are safe'; then pass "$mode: an unexpected error shows the problem screen"; else fail "$mode: an unexpected error shows the problem screen"; fi
  capture "$mode-problem"
  has "$mode-problem" 'text="Restart"' && pass "$mode: problem screen offers Restart" || fail "$mode: problem screen offers Restart"
  tap 'Send a problem report' && capture "$mode-problem-report" || fail "$mode: tap Send a problem report"
  has "$mode-problem-report" 'Problem reports come in a later test build' &&
    pass "$mode: Send a problem report answers" || fail "$mode: Send a problem report answers"
done
adb shell cmd uimode night no

# The database checks, on the real expo-sqlite (spec section 14).
note ""
note "## Database checks on expo-sqlite"
open_link 'mhizha-test://self-test/db'
if wait_for 'Database checks:'; then
  capture db-checks
  RESULT=$(grep -o 'Database checks: [0-9]* passed, [0-9]* failed' "$OUT/db-checks.xml" | head -1)
  note "  ($RESULT)"
  echo "$RESULT" | grep -q ' 0 failed' && pass "database checks pass on expo-sqlite" || fail "database checks pass on expo-sqlite"
else
  fail "database checks ran (no result within 90 s)"
fi
PID=$(adb shell pidof "$PKG" | tr -d "\r")
[ -n "$PID" ] && adb logcat -d --pid="$PID" -s ReactNativeJS:V | grep 'MHIZHA_DB_CHECKS' > "$OUT/db-checks.txt" 2>/dev/null
[ -s "$OUT/db-checks.txt" ] && note "  $(sed 's/.*MHIZHA_DB_CHECKS //' "$OUT/db-checks.txt" | head -c 2000)"

PID=$(adb shell pidof "$PKG" | tr -d '\r')
[ -n "$PID" ] && adb logcat -d --pid="$PID" > "$OUT/app-logcat.txt" 2>/dev/null
adb logcat -d -b crash > "$OUT/crash-logcat.txt" 2>/dev/null
if grep -q "$PKG" "$OUT/crash-logcat.txt"; then fail "no crash"; else pass "no crash"; fi

[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$SUMMARY" >> "$GITHUB_STEP_SUMMARY"
exit $FAILED
