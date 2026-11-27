#!/usr/bin/env bash
# Installs the `.test` APK on a running emulator, checks it opens on Home with
# the shell in place, in light and dark, walks the setup wizard from a new
# install, opens Settings pages and the Price list, adds a Customer with a Job
# and marks it Done, issues an Invoice step by step, opens the problem report,
# Updates and Help, and the failed-check banner, shows the problem screen, runs
# the database checks on the real expo-sqlite, and screenshots every screen for
# the UI review. Usage: launch-check.sh <apk> <results folder>
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

# Tap the text field whose label is exactly $1.
tap_field() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep 'class="android.widget.EditText"' | grep "content-desc=\"$1\"" | head -1 |
    grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '[0-9]*' | tr '\n' ' ')
  # shellcheck disable=SC2086
  set -- $b
  [ $# -eq 4 ] || return 1
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

# Close the on-screen keyboard if it is up (back would otherwise close the screen).
hide_keyboard() {
  adb shell dumpsys input_method | grep -q 'mInputShown=true' && adb shell input keyevent KEYCODE_BACK
  sleep 1
}

# Scroll a screen to its end.
to_end() { for _ in 1 2 3 4; do adb shell input swipe 360 1000 360 250 200; done; sleep 1; }

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
  # A busy 2 GB emulator now and then fails a dump or an input; try again.
  local _try
  for _try in 1 2 3; do
    tap_once "$1" && return 0
    sleep 3
  done
  return 1
}

tap_once() {
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

# hide_keyboard: close the on-screen keyboard if it is open (Back would
# otherwise reach the app).
hide_keyboard() {
  if adb shell dumpsys input_method | grep -q 'mInputShown=true'; then
    adb shell input keyevent KEYCODE_BACK
    sleep 1
  fi
}

# tap_first_field: tap the first text field on the screen.
tap_first_field() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep 'class="android.widget.EditText"' | head -1 |
    grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '[0-9]*' | tr '\n' ' ')
  # shellcheck disable=SC2086
  set -- $b
  [ $# -eq 4 ] || return 1
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

# walk_setup <mode>: a new install shows the first screen; Start new walks the
# setup wizard to Home. The emulator has no screen lock, so the App lock step
# is not asked.
walk_setup() {
  local m="$1"
  if wait_for 'Start new'; then pass "$m: a new install offers Start new"; else fail "$m: a new install offers Start new"; return; fi
  capture "$m-first"
  has "$m-first" 'text="Restore from a backup"' && pass "$m: first screen offers Restore from a backup" || fail "$m: first screen offers Restore from a backup"
  tap 'Start new' || { fail "$m: tap Start new"; return; }
  wait_for 'What is your business called?' && pass "$m: Start new opens setup" || fail "$m: Start new opens setup"
  hide_keyboard
  tap Next
  capture "$m-setup-name-missing"
  has "$m-setup-name-missing" 'Enter the name of your business' &&
    pass "$m: setup asks for the business name before moving on" || fail "$m: setup asks for the business name before moving on"
  tap_first_field
  adb shell input text 'Demo%sBuilding%sServices'
  hide_keyboard
  capture "$m-setup-business"
  local step
  for step in contact look payment signature numbers start period; do
    tap Next || { fail "$m: tap Next towards $step"; return; }
    capture "$m-setup-$step"
  done
  has "$m-setup-period" 'text="Finish"' && pass "$m: the Accounting period is the last step without a screen lock" ||
    fail "$m: the Accounting period is the last step without a screen lock"
  has "$m-setup-period" 'Every month' && pass "$m: Accounting period offers monthly" || fail "$m: Accounting period offers monthly"
  tap Finish || fail "$m: tap Finish"
}

echo "# Launch check" > "$SUMMARY"
note ""
note "Emulator: Android $(adb shell getprop ro.build.version.release | tr -d '\r'), API $(adb shell getprop ro.build.version.sdk | tr -d '\r'), $(adb shell wm size | tr -d '\r' | sed 's/Physical size: //'), $(adb shell grep MemTotal /proc/meminfo | tr -d '\r' | tr -s ' ')"
note "APK: $(ls -l "$APK" | awk '{printf "%.1f MB", $5/1048576}')"
note ""

adb uninstall "$PKG" >/dev/null 2>&1 || true
if INSTALL=$(adb install "$APK" 2>&1); then pass "installs"; else fail "installs: $INSTALL"; fi

# On the 2 GB emulator Google Play services runs out of memory and restarts
# over and over, until the system itself dies mid-check. Mhizha does not use it,
# so it is switched off there; the check stays about Mhizha.
MEM_KB=$(adb shell grep MemTotal /proc/meminfo | tr -d '\r' | tr -s ' ' | cut -d' ' -f2)
if [ "${MEM_KB:-0}" -lt 3000000 ]; then
  for p in com.google.android.gms com.android.vending; do
    note "  (switch off $p: $(adb shell pm disable-user --user 0 $p 2>&1 | tr -d '\r'))"
  done
fi

for mode in light dark; do
  set_night "$mode"
  # Each mode starts as a new install, so setup is checked in light and dark.
  adb shell pm clear "$PKG" >/dev/null 2>&1
  launch
  walk_setup "$mode"
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
  has "$mode-settings" "text=\"Demo Building Services\"" && pass "$mode: Settings shows the business" || fail "$mode: Settings shows the business"
  tap "Document numbers" && capture "$mode-settings-numbers" || fail "$mode: open Document numbers"
  has "$mode-settings-numbers" "First Invoice number" && pass "$mode: Document numbers open from Settings" || fail "$mode: Document numbers open from Settings"
  adb shell input keyevent KEYCODE_BACK
  tap "Demo Building Services" && capture "$mode-settings-business" || fail "$mode: open Your business"
  has "$mode-settings-business" 'text="Business name"' && pass "$mode: Your business opens from Settings" || fail "$mode: Your business opens from Settings"
  adb shell input keyevent KEYCODE_BACK
  sleep 1
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

  # Customers, Sites and Jobs. Each mode starts from a new install (above), so
  # each adds its own Customer and Job.
  tap Customers
  capture "$mode-customers-empty"
  has "$mode-customers-empty" 'No Customers yet' && pass "$mode: Customers tab says how to add one" || fail "$mode: Customers tab says how to add one"
  tap 'Add a Customer' && capture "$mode-customer-form" || fail "$mode: open New Customer"
  has "$mode-customer-form" 'Fill in from phone contacts' && pass "$mode: New Customer offers the phone contacts" || fail "$mode: New Customer offers the phone contacts"
  to_end
  tap 'Save Customer' && capture "$mode-customer-form-errors" || fail "$mode: tap Save Customer"
  has "$mode-customer-form-errors" "Enter the Customer's name" &&
    pass "$mode: a Customer with no name is refused, saying why" || fail "$mode: a Customer with no name is refused, saying why"
  adb shell input swipe 360 250 360 1100 200; adb shell input swipe 360 250 360 1100 200
  tap_field Name && adb shell input text 'Test%sCustomer' || fail "$mode: type a name"
  tap_field 'Phone (optional)' && adb shell input text '0771234567' || fail "$mode: type a phone"
  hide_keyboard
  to_end
  tap 'Save Customer' && sleep 1 || fail "$mode: save the Customer"
  adb shell input keyevent KEYCODE_BACK
  tap Customers
  capture "$mode-customers"
  has "$mode-customers" 'Test Customer' && pass "$mode: the Customer is listed" || fail "$mode: the Customer is listed"
  tap 'Test Customer, Main site' && capture "$mode-customer" || fail "$mode: open the Customer"
  has "$mode-customer" 'content-desc="Call Test Customer on 0771234567"' && has "$mode-customer" 'content-desc="WhatsApp Test Customer on 0771234567"' &&
    pass "$mode: the Customer screen has Call and WhatsApp" || fail "$mode: the Customer screen has Call and WhatsApp"
  tap 'Add Job' && capture "$mode-job-form" || fail "$mode: open New Job"
  adb shell input text 'Kitchen%srewiring'
  hide_keyboard
  tap 'Add Job' || fail "$mode: add the Job"
  capture "$mode-job"
  has "$mode-job" 'Mark Job Done' && pass "$mode: the Job is Open" || fail "$mode: the Job is Open"
  tap 'Mark Job Done' && capture "$mode-job-done" || fail "$mode: open Mark Done"
  DAY=$(adb shell date +%d | tr -d '\r')
  has "$mode-job-done" "Date the work finished, $((10#$DAY)) $(adb shell date +'%B %Y' | tr -d '\r')" &&
    pass "$mode: Done asks for the date work finished, today by default" || fail "$mode: Done asks for the date work finished, today by default"
  if [ "$mode" = light ]; then
    tap 'Mark Done' && capture "$mode-job-marked" || fail "$mode: mark Done"
    has "$mode-job-marked" 'Work finished' && pass "$mode: the Job is Done" || fail "$mode: the Job is Done"
    tap 'Open the Job again' || fail "$mode: open the Job again"
  fi
  # Back closes the sheet (dark), the Job, the Customer, then the tab goes Home.
  back_until 'Welcome to Mhizha' 5
  capture "$mode-customers-back"
  has "$mode-customers-back" 'Welcome to Mhizha' && pass "$mode: back closes the Job, the Customer, then goes Home" || fail "$mode: back closes the Job, the Customer, then goes Home"

  # An Invoice with no Quotation, step by step from New: who, which Job, the
  # lines with a 10% Discount, then check and issue. Home then shows what
  # Customers owe and the Documents tab lists it.
  tap 'New Quotation, Invoice, Payment or Customer' && tap 'Invoice, Bill a Customer for a Job' || fail "$mode: New offers an Invoice"
  wait_for 'Who is it for?' && pass "$mode: New Invoice asks who it is for" || fail "$mode: New Invoice asks who it is for"
  capture "$mode-invoice-who"
  tap 'Test Customer' || fail "$mode: pick the Customer"
  wait_for 'Which Job?' && pass "$mode: then which Job" || fail "$mode: then which Job"
  capture "$mode-invoice-job"
  tap 'Kitchen rewiring, Main site, Open' || fail "$mode: pick the Job"
  wait_for 'What are you charging for?' && pass "$mode: then the lines" || fail "$mode: then the lines"
  capture "$mode-invoice-lines-empty"
  tap 'Type a line' || fail "$mode: open Type a line"
  tap_field Description && adb shell input text 'Labour' || fail "$mode: type a description"
  hide_keyboard
  tap_field 'Unit price (US\$)' && adb shell input text '45' || fail "$mode: type a price"
  hide_keyboard
  capture "$mode-invoice-line"
  tap 'Add line' || fail "$mode: add the line"
  to_end
  tap '%' || fail "$mode: pick a % Discount"
  to_end
  tap_field 'Discount in %' && adb shell input text '10' || fail "$mode: type the Discount"
  hide_keyboard
  to_end
  capture "$mode-invoice-lines"
  has "$mode-invoice-lines" '10% = US\$4\.50' && pass "$mode: the Discount shows as it is typed" || fail "$mode: the Discount shows as it is typed"
  tap Next || fail "$mode: tap Next to Check and issue"
  wait_for 'Check and issue' && capture "$mode-invoice-check" || fail "$mode: Check and issue opens"
  to_end
  capture "$mode-invoice-check-end"
  { has "$mode-invoice-check" 'Total US\$40\.50' || has "$mode-invoice-check-end" 'Total US\$40\.50'; } &&
    pass "$mode: the Total is after the Discount" || fail "$mode: the Total is after the Discount"
  # The Draft preview: its pages marked DRAFT, with nothing to share.
  tap 'Preview the Invoice' || fail "$mode: tap Preview the Invoice"
  wait_for 'marked DRAFT' && pass "$mode: the Draft previews marked DRAFT" || fail "$mode: the Draft previews marked DRAFT"
  sleep 3
  capture "$mode-invoice-preview"
  has "$mode-invoice-preview" 'Share' && fail "$mode: the Draft preview offers no Share" || pass "$mode: the Draft preview offers no Share"
  adb shell input keyevent KEYCODE_BACK
  wait_for 'Check and issue' && to_end || fail "$mode: back from the preview to Check and issue"
  tap 'Issue INV-0001' || fail "$mode: tap Issue"
  capture "$mode-invoice-confirm"
  tap 'Issue INV-0001' || fail "$mode: confirm Issue"
  wait_for 'Unpaid · US\$40\.50' && pass "$mode: the Invoice is issued as INV-0001, Unpaid" || fail "$mode: the Invoice is issued as INV-0001, Unpaid"
  wait_for 'text="Share PDF"' && pass "$mode: the PDF is made at issue" || fail "$mode: the PDF is made at issue"
  capture "$mode-invoice"
  tap 'Share PDF' && sleep 3 && capture "$mode-invoice-share" || fail "$mode: tap Share PDF"
  has "$mode-invoice-share" 'android:id/(chooser|resolver)|com.android.intentresolver|Share INV-0001' &&
    pass "$mode: Share PDF opens the Share menu" || fail "$mode: Share PDF opens the Share menu"
  adb shell input keyevent KEYCODE_BACK
  wait_for 'Unpaid · US\$40\.50' || fail "$mode: back from the Share menu"
  back_until 'Customers owe you' 3
  capture "$mode-home-owed"
  has "$mode-home-owed" 'Customers owe you US\$40\.50' && pass "$mode: Home shows what Customers owe" || fail "$mode: Home shows what Customers owe"
  tap Documents && capture "$mode-documents-list" || fail "$mode: open Documents"
  has "$mode-documents-list" 'INV-0001' && pass "$mode: the Documents tab lists the Invoice" || fail "$mode: the Documents tab lists the Invoice"

  # The problem report from Settings.
  # Help sits below the setup pages and About, so scroll to it.
  tap Settings && to_end && tap 'Send a problem report' && capture "$mode-report" || fail "$mode: open the problem report from Settings"
  has "$mode-report" 'Mhizha problem report [0-9-]*\.txt' && has "$mode-report" 'text="Share the report"' &&
    pass "$mode: Settings opens the problem report" || fail "$mode: Settings opens the problem report"
  has "$mode-report" 'Record counts' && pass "$mode: the report shows record counts" || fail "$mode: the report shows record counts"
  has "$mode-report" 'Test Customer|0771234567' && fail "$mode: the report holds no Customer details" || pass "$mode: the report holds no Customer details"

  # Updates and Help, at the end of Settings. The site may not have a version
  # file yet, so any plain answer from Check for updates passes.
  adb shell input keyevent KEYCODE_BACK
  to_end && capture "$mode-settings-end"
  has "$mode-settings-end" 'Check once a day' && pass "$mode: Settings has the daily update check switch" || fail "$mode: Settings has the daily update check switch"
  tap 'Check for updates, [^"]*' || fail "$mode: tap Check for updates"
  sleep 15
  capture "$mode-update-check"
  has "$mode-update-check" 'is the latest version|Could not reach the Mhizha site|is ready\. Make a Backup' &&
    pass "$mode: Check for updates answers" || fail "$mode: Check for updates answers"
  tap 'Help and guides, [^"]*' && capture "$mode-help" || fail "$mode: open Help"
  has "$mode-help" 'Make a Quotation' && pass "$mode: Help shows the tutorials" || fail "$mode: Help shows the tutorials"
  to_end && to_end && capture "$mode-help-end"
  has "$mode-help-end" 'issues are public' && pass "$mode: Help warns that GitHub issues are public" || fail "$mode: Help warns that GitHub issues are public"

  # The red banner when a check on open fails, through the test build's link.
  open_link 'mhizha-test://self-test/check-failed'
  if wait_for 'A check failed'; then pass "$mode: a failed check shows the banner"; else fail "$mode: a failed check shows the banner"; fi
  capture "$mode-check-failed"
  has "$mode-check-failed" 'content-desc="Customers"' && pass "$mode: the banner does not block work" || fail "$mode: the banner does not block work"
  tap '! A check failed. Please send a problem report.' && capture "$mode-check-report" || fail "$mode: tap the banner"
  has "$mode-check-report" 'text="Share the report"' && pass "$mode: the banner opens the problem report" || fail "$mode: the banner opens the problem report"

  # The problem screen, through the test build's link.
  open_link 'mhizha-test://self-test/error'
  if wait_for 'Your records are safe'; then pass "$mode: an unexpected error shows the problem screen"; else fail "$mode: an unexpected error shows the problem screen"; fi
  capture "$mode-problem"
  has "$mode-problem" 'text="Restart"' && pass "$mode: problem screen offers Restart" || fail "$mode: problem screen offers Restart"
  tap 'Send a problem report' && capture "$mode-problem-report" || fail "$mode: tap Send a problem report"
  has "$mode-problem-report" 'Mhizha problem report [0-9-]*\.txt' && has "$mode-problem-report" 'holds no Customer details' &&
    pass "$mode: the problem screen shows the report" || fail "$mode: the problem screen shows the report"
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

# The PDF checks, on the real expo-print and the phone's WebView (spec section 10).
note ""
note "## PDF checks on expo-print"
open_link 'mhizha-test://self-test/pdf'
if wait_for 'PDF checks:'; then
  capture pdf-checks
  RESULT=$(grep -o 'PDF checks: [0-9]* passed, [0-9]* failed' "$OUT/pdf-checks.xml" | head -1)
  note "  ($RESULT)"
  echo "$RESULT" | grep -q ' 0 failed' && pass "PDF checks pass on expo-print" || fail "PDF checks pass on expo-print"
else
  fail "PDF checks ran (no result in time)"
fi
PID=$(adb shell pidof "$PKG" | tr -d "\r")
[ -n "$PID" ] && adb logcat -d --pid="$PID" -s ReactNativeJS:V | grep 'MHIZHA_PDF_CHECKS' > "$OUT/pdf-checks.txt" 2>/dev/null
[ -s "$OUT/pdf-checks.txt" ] && note "  $(sed 's/.*MHIZHA_PDF_CHECKS //' "$OUT/pdf-checks.txt" | head -c 2000)"

PID=$(adb shell pidof "$PKG" | tr -d '\r')
[ -n "$PID" ] && adb logcat -d --pid="$PID" > "$OUT/app-logcat.txt" 2>/dev/null
adb logcat -d -b crash > "$OUT/crash-logcat.txt" 2>/dev/null
if grep -q "$PKG" "$OUT/crash-logcat.txt"; then fail "no crash"; else pass "no crash"; fi

[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$SUMMARY" >> "$GITHUB_STEP_SUMMARY"
exit $FAILED
