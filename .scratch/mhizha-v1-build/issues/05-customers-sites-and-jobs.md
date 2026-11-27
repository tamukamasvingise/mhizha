# 05: Customers, Sites and Jobs

**What to build:** The User can add Customers with their Sites and Jobs, call or WhatsApp them from the Customer screen, and mark Jobs Done or Dropped. Spec section 5. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** 02 Database base

**Status:** ready-for-agent

- [ ] Customer: person or organisation, phones, WhatsApp, email, structured address, tax number, notes, one or more Sites
- [ ] Site with structured address and optional contact person; Job at one Site
- [ ] Customer screen with Call and WhatsApp buttons, notes and a follow-up date (its reminder comes in Reminders)
- [ ] Job Open, Done or Dropped by hand; Done asks for the date work finished, today by default, never later
- [ ] Customers, Sites and Jobs with Issued Documents or Payments can only be archived
- [ ] Optional import from the phone's contacts
