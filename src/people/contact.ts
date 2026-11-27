// Links that open the phone's dialler and WhatsApp for a Customer's number.

/** Zimbabwe's calling code: numbers typed with a leading 0 are taken as Zimbabwean. */
export const HOME_COUNTRY_CODE = '263';

/** A `tel:` link that opens the dialler on the number, or null if there is none. */
export function callLink(raw: string): string | null {
  const v = raw.trim();
  if (v === '') return null;
  return `tel:${v.startsWith('+') ? '+' : ''}${v.replace(/\D/g, '')}`;
}

/** The number in international form, digits only, as WhatsApp wants it. */
export function internationalDigits(raw: string): string {
  const v = raw.trim();
  const digits = v.replace(/\D/g, '');
  if (v.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return HOME_COUNTRY_CODE + digits.slice(1);
  if (digits.length <= 9) return HOME_COUNTRY_CODE + digits;
  return digits;
}

/** A link that opens a WhatsApp chat with the number, or null if there is none. */
export function whatsappLink(raw: string): string | null {
  if (raw.trim() === '') return null;
  return `https://wa.me/${internationalDigits(raw)}`;
}
