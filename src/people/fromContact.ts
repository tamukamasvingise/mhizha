import type { CustomerDetails } from '.';

// What a contact picked from the phone fills in on a new Customer. Plain
// TypeScript: the shape is the part of an expo-contacts contact Mhizha reads.

type Maybe = string | null | undefined;

export type PickedContact = {
  fullName?: Maybe;
  givenName?: Maybe;
  familyName?: Maybe;
  company?: Maybe;
  phones?: { number?: Maybe; label?: Maybe }[];
  emails?: { address?: Maybe }[];
  addresses?: { street?: Maybe; city?: Maybe; region?: Maybe; state?: Maybe; country?: Maybe }[];
};

export type ContactFill = Pick<CustomerDetails, 'kind' | 'name' | 'phones' | 'email' | 'address'>;

const t = (v: Maybe) => (v ?? '').trim();

export function fromContact(c: PickedContact): ContactFill {
  const person = t(c.givenName) !== '' || t(c.familyName) !== '';
  const company = t(c.company);
  const a = c.addresses?.[0] ?? {};
  return {
    kind: !person && company !== '' ? 'organisation' : 'person',
    name: t(c.fullName) || [t(c.givenName), t(c.familyName)].filter(Boolean).join(' ') || company,
    phones: (c.phones ?? []).map((p) => t(p.number)).filter((n) => n !== ''),
    email: (c.emails ?? []).map((e) => t(e.address)).find((e) => e !== '') ?? '',
    address: { lines: t(a.street), suburb: '', city: t(a.city), province: t(a.region) || t(a.state), country: t(a.country) },
  };
}
