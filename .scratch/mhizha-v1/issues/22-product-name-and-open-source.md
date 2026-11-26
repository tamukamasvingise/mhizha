# Product name and open source

Label: wayfinder:grilling
Type: grilling
Status: resolved

## Question

The owner wants the project open source and public on GitHub, as a portfolio piece and a possible product for the Play Store later, no longer tied to the client that first asked for it, which stays its first user. What is the new product name and permanent package name, which licence, what in the repo and its history must be removed or rewritten (client name, business details, sales questions, design paths) before going public, and where does the repo move? The repo goes public only once this is resolved.

From Signing and delivery: the package name is fixed before the first real install and can never change; test builds add `.test`. A public repo gets unlimited GitHub Actions minutes; signing secrets stay hidden.

## Answer

Decided with the owner on 2026-11-26.

### Ownership

- The product belongs to the owner, who develops and owns it. It is not connected to the client that first asked for it, which uses it only as a reference user. No agreement with that client is needed.
- The reference user is named nowhere in the public repo. Planning notes that came from it are rewritten as what version 1 assumes about a Business (for example, "Version 1 serves a Business not registered for VAT").

### Product

- Name: **Mhizha** (Shona for a skilled craftsman). A web and app store search found no app of that name; it was not a trademark check.
- For construction service providers: plumbers, builders, electricians and similar trades who quote, invoice and take payments for Jobs at a Customer's Site. Zimbabwe is the first market.

### Names

- Package name, permanent: `io.github.tamukamasvingise.mhizha`. Test builds: `io.github.tamukamasvingise.mhizha.test`. No domain is needed.
- Repo: `github.com/tamukamasvingise/mhizha`. Local folder: a new top-level folder for the owner's open source projects.

### Licence and contributions

- GPL-3.0. The name Mhizha and its logo are not licensed; the README says so.
- Issues only, resolved by the owner. No outside code, so the owner stays the sole copyright holder.

### History

- A new public repo starts from one commit of the cleaned files. The old planning repo stays private and archived as the record. Its local copy is removed once the new repo works.
- Commits keep the owner's own email; the owner accepts that it is visible.

### Terms

- **Business** (the trade on the Documents) and **User** (the person holding the phone) replace the client's name in the glossary and notes.

### Document layouts

- One layout for now, based on the reference user's documents, unbranded. Each Business uploads its own logo and details at setup. More layouts later.
- The reference user's logo, watermark, letterhead and designs stay outside the repo; they reach its phone only as setup data.

### The work

- Done in [Go public](23-go-public.md).
