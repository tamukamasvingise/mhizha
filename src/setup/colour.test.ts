import { describe, expect, it } from 'vitest';
import { contrast } from '../ui/tokens';
import { PAPER, parseColour, textColourFor } from './colour';

describe('brand colour', () => {
  it('reads #RGB and #RRGGBB in either case, with or without the #', () => {
    expect(parseColour('#c2410c')).toBe('#C2410C');
    expect(parseColour('1d4ed8')).toBe('#1D4ED8');
    expect(parseColour(' #fc0 ')).toBe('#FFCC00');
  });

  it('refuses anything that is not a colour', () => {
    expect(parseColour('orange')).toBeNull();
    expect(parseColour('#12345')).toBeNull();
    expect(parseColour('')).toBeNull();
  });

  it('keeps a colour dark enough for small text on the page', () => {
    expect(textColourFor('#C2410C')).toBe('#C2410C');
    expect(textColourFor('#18181B')).toBe('#18181B');
  });

  it('darkens a pale colour for text only, until small text reads on white', () => {
    for (const pale of ['#FACC15', '#FFFFFF', '#7DD3FC', '#FB923C']) {
      const text = textColourFor(pale);
      expect(text).not.toBe(pale);
      expect(contrast(text, PAPER)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the hue when darkening: a yellow stays more red and green than blue', () => {
    const text = textColourFor('#FACC15');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b!);
    expect(g).toBeGreaterThan(b!);
  });
});
