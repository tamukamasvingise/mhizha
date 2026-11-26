# Install and update proof

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03, 04, 05, 11, 15, 22, 23

## Question

Build a throwaway test app; install it, save a record and a PDF, install a newer version over it, and confirm the data survives on both the weak and the strong phone. Check the app lock with each lock type the phones have, including PIN only on Android 10 if available. Record every warning seen and how long each step took.

From Signing and delivery: use the test package (real name plus `.test`) and the test key, built by GitHub Actions, delivered by Google Drive link. Also check that installing over keeps the data and that the database copy is made on first open.
