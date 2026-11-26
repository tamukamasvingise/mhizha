# Build route

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

Expo's Free plan may not cover this commercial app (see ticket 04). Is the main build route GitHub Actions with Gradle, with Expo cloud builds only for the proof of concept, or do we ask Expo about eligibility first?

## Answer

Decided by the owner, 2026-11-25: GitHub Actions (`expo prebuild` plus Gradle) is the main build route. Expo cloud builds are for the proof of concept only, unless Expo confirms the app qualifies for its Free plan.
