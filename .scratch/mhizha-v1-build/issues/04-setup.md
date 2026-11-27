# 04: Setup

**What to build:** A new install offers Start new; the setup wizard walks the User through business details, Document numbers, Start date, Accounting period and the App lock question. Everything can be changed later in Settings. Spec section 4. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 02 Database base

**Status:** ready-for-agent

- [ ] First screen shows Start new and Restore from a backup (Restore is a later ticket; the button can say it is coming)
- [ ] Business details: name, trading-as, what we do, phones, email, structured address, tax number, logo, brand colour (pale colours darkened for text), font, watermark, payment details, optional drawn signature
- [ ] Starting number per Document type, locked once the first of that type is Issued
- [ ] Start date (today by default) and Accounting period (monthly and January prefilled; a change applies from the next period)
- [ ] App lock asked once, only if the phone has a screen lock; uses the phone's own lock; can be changed in Settings
- [ ] Business details and the Accounting period are kept with the date each took effect
