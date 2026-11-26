# Install and update proof (PROTOTYPE, throwaway)

Answers the ticket Install and update proof. Not Mhizha code; never merged into main.

- `app/`: the files laid over a fresh Expo blank TypeScript app. The app saves one Customer, one Document and its PDF on first open, runs numbered upgrade steps (copying the database first), and reports what it finds.
- `build.sh`: builds versions 1, 2 and 3 (3 has a step that fails on purpose) with `expo prebuild` and Gradle, signs them with a test key made for the run, and signs version 2 again with another key.
- `run-proof.sh`: installs, updates and opens the app on the emulator, checks each report and saves a screenshot per step.
- `.github/workflows/install-update-proof.yml`: runs it all on GitHub Actions, on Android 10 (2 GB, 720p, Google Play image) and a current Android.

Results: the `proof-results-*` artifacts of each workflow run (`summary.md`, screenshots, reports).
