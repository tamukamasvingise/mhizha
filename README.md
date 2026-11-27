# Mhizha

Mhizha (Shona for a skilled craftsman) is a planned offline Android app for construction service providers: plumbers, builders, electricians and similar trades. It keeps Customers, Sites and Jobs, and issues Quotations, Invoices and Receipts as PDFs, without internet, a server or a monthly fee. Zimbabwe is the first market; amounts are in US dollars.

## Status

Building version 1. The app so far is its shell. The plan is a map of decisions worked one at a time:

- Map: [.scratch/mhizha-v1/map.md](.scratch/mhizha-v1/map.md)
- Terms: [GLOSSARY.md](GLOSSARY.md)
- Research notes: [docs/research](docs/research)

Planned stack: Expo with TypeScript and SQLite on the phone, built with GitHub Actions, installed as an APK outside the Play Store.

## Development

Expo SDK 58 with TypeScript, built only in GitHub Actions (no Expo cloud builds). Use pnpm, never npm.

- `pnpm install`, then `pnpm test` (Vitest) and `pnpm typecheck`.
- Records: `src/db` opens SQLite and runs the numbered upgrade steps in `src/db/steps.ts` (add a step, never edit a released one). Its checks in `src/db/checks.ts` run on Node's SQLite in `pnpm test` and on expo-sqlite in the launch check, through the test build's `mhizha-test://self-test/db` link.
- The look is in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md); its values in `src/ui/tokens.ts`.
- Every push runs `.github/workflows/ci.yml`: tests, a `.test` APK (`io.github.tamukamasvingise.mhizha.test`, arm64-v8a, armeabi-v7a and x86_64), and a launch check on Android 10 (2 GB, 720p) and current emulators. The APK and screenshots are kept 7 days as run artifacts.
- Test signing key, read from these Actions secrets when they exist: `MHIZHA_TEST_KEYSTORE_BASE64` (the keystore, base64), `MHIZHA_TEST_KEYSTORE_PASSWORD`, `MHIZHA_TEST_KEY_ALIAS`, `MHIZHA_TEST_KEY_PASSWORD` (defaults to the store password). Without them each run signs with a throwaway key, so its APK cannot install over a `.test` build from another run. Never commit a keystore.

## Contributing

Issues are welcome: bugs, questions and ideas. Pull requests are not accepted; the owner writes all the code.

## Licence

The code and documents are under the [GNU General Public License v3.0](LICENSE).

The name Mhizha and its logo are not covered by that licence. Forks must use a different name and logo.
