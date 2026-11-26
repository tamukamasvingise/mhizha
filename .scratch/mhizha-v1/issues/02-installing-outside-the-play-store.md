# Installing outside the Play Store

Label: wayfinder:research
Type: research
Status: resolved

## Question

What must hold to install and update this APK on phones in Zimbabwe for free, now and after the 2027 global developer-verification expansion? Settle the 20 or 50 device limit, who the rule applies to, how devices are added to a limited distribution account, the advanced flow, Play Protect warnings, and the rules that make an update keep app data (package name, signing key, version code).

## Answer

[docs/research/installing-outside-play.md](../../../docs/research/installing-outside-play.md) (documentation only, nothing tested).

- Now: direct APK installs in Zimbabwe are not covered. Global rollout starts January 2027 over several months, for all install sources on certified Android 8+ phones. Zimbabwe's date is unknown.
- Limited distribution: free, 50 devices (the 20 figure is stale), but states no commercial intent; eligibility unconfirmed.
- Advanced flow: free, no account; restart and 24-hour wait, then on for 7 days or indefinitely. ADB is exempt. Full account: $25.
- Declare no SMS, notification-listener or accessibility permissions (Play Protect).
- Updates keep data with the same package name and signing key and a higher version code, never uninstalling. Freeze name and key before the first real install.
- Unknown: whether the advanced flow is on these phones, and whether installed unregistered apps keep running (inferred yes).
