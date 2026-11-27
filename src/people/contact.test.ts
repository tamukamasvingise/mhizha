import { describe, expect, it } from 'vitest';
import { callLink, whatsappLink } from './contact';

describe('calling and WhatsApp', () => {
  it('calls the number as typed, without spaces or brackets', () => {
    expect(callLink('077 123 4567')).toBe('tel:0771234567');
    expect(callLink('+263 (24) 270-0000')).toBe('tel:+263242700000');
  });

  it('opens WhatsApp on the international number, Zimbabwe unless another country is given', () => {
    expect(whatsappLink('077 123 4567')).toBe('https://wa.me/263771234567');
    expect(whatsappLink('+27 82 123 4567')).toBe('https://wa.me/27821234567');
    expect(whatsappLink('00263 71 987 6543')).toBe('https://wa.me/263719876543');
    expect(whatsappLink('771234567')).toBe('https://wa.me/263771234567');
  });

  it('has no link for an empty number', () => {
    expect(callLink(' ')).toBeNull();
    expect(whatsappLink('')).toBeNull();
  });
});
