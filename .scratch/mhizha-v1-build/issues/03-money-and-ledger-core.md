# 03: Money and ledger core

**What to build:** A plain TypeScript module, free of Expo, holds the money rules and the double-entry ledger so every later ticket can rely on them. Written test first. Spec sections 6 (rules), 7 and 9. See the [spec](../../mhizha-v1/spec.md).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Whole cents and thousandths only; line amount rounds half a cent up; lines add exactly to the Subtotal; Subtotal - Discount + VAT = Total
- [ ] Discount as amount or percentage (0 to 99.9), never above the Subtotal; Discount shares across several Invoices with the last taking the leftover cents
- [ ] "The sum of" wording in words, for example "One hundred and fifty US dollars and twenty-five cents only"
- [ ] Balanced journal entries with accounting date and recorded time; unbalanced entries are refused; corrections are reversing entries
- [ ] Checks: debits equal credits, and Customer ledgers agree with Customers owe, Deposits held and Credit held
- [ ] fast-check harness that runs random sequences and asserts the seven rules after every step; later tickets add their events to it
