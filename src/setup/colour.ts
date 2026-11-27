// The Business's brand colour on its Documents. These colours are the
// Business's own data, printed on white paper; they are not app tokens.
import { contrast } from '../ui/tokens';

/** The page a Document prints on. */
export const PAPER = '#FFFFFF';

/** The premade brand colours offered at setup, first is the default. */
export const BRAND_COLOURS: readonly { name: string; hex: string }[] = [
  { name: 'Orange', hex: '#C2410C' },
  { name: 'Red', hex: '#B91C1C' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green', hex: '#15803D' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Blue', hex: '#1D4ED8' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Purple', hex: '#7E22CE' },
  { name: 'Grey', hex: '#52525B' },
];

/** `#RRGGBB` in capitals, or null when the text is not a colour. */
export function parseColour(text: string): string | null {
  const t = text.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(t)) return `#${[...t].map((ch) => ch + ch).join('')}`.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`.toUpperCase();
  return null;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();

/**
 * The colour for small text on a Document: the brand colour itself when it
 * reads on white (4.5:1), otherwise the same hue darkened until it does.
 */
export function textColourFor(brand: string): string {
  const colour = parseColour(brand) ?? brand;
  if (contrast(colour, PAPER) >= 4.5) return colour;
  const rgb = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
  for (let keep = 0.99; keep > 0; keep -= 0.01) {
    const darker = `#${rgb.map((c) => hex2(c * keep)).join('')}`;
    if (contrast(darker, PAPER) >= 4.5) return darker;
  }
  return '#000000';
}
