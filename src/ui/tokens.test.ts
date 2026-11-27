import { describe, expect, it } from 'vitest';
import { contrast, themes } from './tokens';

// WCAG 2.2: text needs 4.5:1, icons, control borders and focus rings 3:1.
// Pairs are what actually sits on what in the shell.
const textPairs = [
  ['fg', 'page'],
  ['fg', 'surface'],
  ['label', 'page'],
  ['label', 'surface'],
  ['label', 'tint'],
  ['primaryFg', 'primary'],
  ['selFg', 'sel'],
  ['bad', 'surface'],
  ['bad', 'page'],
  ['toastFg', 'toast'],
] as const;

const nonTextPairs = [
  ['input', 'surface'],
  ['brand', 'surface'],
  ['ring', 'page'],
  ['ring', 'surface'],
  ['primary', 'page'],
] as const;

describe.each(['light', 'dark'] as const)('%s theme', (mode) => {
  const t = themes[mode];

  it.each(textPairs)('%s text on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(nonTextPairs)('%s on %s reaches 3:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe('contrast', () => {
  it('matches known WCAG ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #777777 on white is the textbook near-miss: 4.48:1.
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});
