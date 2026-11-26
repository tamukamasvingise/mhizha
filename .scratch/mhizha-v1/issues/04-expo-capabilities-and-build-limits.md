# Expo capabilities and build limits

Label: wayfinder:research
Type: research
Status: resolved

## Question

Does the current Expo SDK support, free and offline: SQLite with migrations and encryption, biometric or PIN lock, scheduled local notifications, contacts import, dialler and WhatsApp links, background tasks? State the minimum Android version, what needs a development build rather than Expo Go, and free limits for EAS cloud builds. Can GitHub Actions build the APK free from a private repo as a backup?

## Answer

[docs/research/expo-capabilities.md](../../../docs/research/expo-capabilities.md) (documentation only, nothing built).

- SDK 58 covers every listed feature free. Background tasks need a network and are inexact, so reminders use scheduled notifications.
- Minimum Android 7; the Android 10 floor fits. SQLCipher needs a development build.
- Expo Free: 15 Android builds a month. Its policy limits it to pre-revenue startups, proofs of concept, hobby and student projects; commercial projects over $1,500 a month must pay (https://expo.dev/acceptable-use#free-plan). Whose revenue counts is not stated.
- GitHub Actions is documented as workable: $12 of compute a month, about 2,000 Linux minutes, shared across the account.
- Unknown: Expo eligibility, real Actions build time, Android 10 PIN fallback, reminders on the real phone.
