import { describe, expect, it } from 'vitest';
import { fromContact } from './fromContact';

describe('filling in a new Customer from a phone contact', () => {
  it('takes the name, phone numbers, first email and first address', () => {
    expect(
      fromContact({
        fullName: 'Tendai Moyo',
        givenName: 'Tendai',
        familyName: 'Moyo',
        company: null,
        phones: [{ number: '077 123 4567', label: 'mobile' }, { number: '' }, { number: '0242 700 000' }],
        emails: [{ address: 'tendai@example.com' }, { address: 'other@example.com' }],
        addresses: [{ street: '4 Acacia Close', city: 'Harare', region: 'Harare', country: 'Zimbabwe' }],
      }),
    ).toEqual({
      kind: 'person',
      name: 'Tendai Moyo',
      phones: ['077 123 4567', '0242 700 000'],
      email: 'tendai@example.com',
      address: { lines: '4 Acacia Close', suburb: '', city: 'Harare', province: 'Harare', country: 'Zimbabwe' },
    });
  });

  it('a contact that is only a company becomes an organisation', () => {
    expect(fromContact({ fullName: null, givenName: null, familyName: null, company: 'Harare Gardens Lodge' })).toMatchObject({
      kind: 'organisation',
      name: 'Harare Gardens Lodge',
      phones: [],
      email: '',
    });
  });

  it('uses the state when there is no region, and leaves out what the contact lacks', () => {
    expect(fromContact({ fullName: 'Chipo', addresses: [{ state: 'Mashonaland East' }] }).address).toEqual({
      lines: '',
      suburb: '',
      city: '',
      province: 'Mashonaland East',
      country: '',
    });
  });
});
