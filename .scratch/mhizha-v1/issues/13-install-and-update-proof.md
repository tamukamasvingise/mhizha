# Install and update proof

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03, 04, 11, 15, 22, 23

## Question

Build a throwaway test app; install it, save a record and a PDF, install a newer version over it, and confirm the data survives. Record every problem seen and how long each step took.

Owner, 2026-11-26: this runs on the Android emulator inside GitHub Actions, not on the owner's PC or a real phone. Run it on an Android 10 emulator with 2 GB RAM and a 720p screen (Google Play image) and on a current Android version. A script drives every step and saves a screenshot of each. Real phone checks follow in Real phone check.

From Signing and delivery: use the test package (real name plus `.test`) and the test key, built by GitHub Actions. Also check that installing over keeps the data and that the database copy is made on first open.

From Data model: the newer test version adds one numbered database upgrade step; check that it runs once, keeps every record and the PDF file, and that the upgrade log shows it.
