import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { FONTS } from '../setup/store';
import { FONT_DATA } from './fontData';
import { lineCount, textWidth } from './measure';

describe('the Document fonts', () => {
  it('are built in for every font the Business can choose, in three weights', () => {
    for (const font of FONTS) {
      const data = FONT_DATA[font]!;
      for (const w of [400, 600, 700] as const) expect(Buffer.from(data.files[w], 'base64').subarray(0, 4).toString('latin1')).toBe('wOF2');
    }
  });

  it('match the font packages they were made from', () => {
    expect(() => execFileSync(process.execPath, ['scripts/pdf-fonts.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});

describe('measuring text', () => {
  it('finds wide letters wider than narrow ones, and breaks lines at spaces', () => {
    const s = { font: 'Inter' as const, size: 10 };
    expect(textWidth('WWWW', s)).toBeGreaterThan(textWidth('iiii', s) * 2);
    const word = textWidth('Labour', s);
    expect(lineCount('Labour Labour Labour', word * 2 + 5, s)).toBe(2);
    expect(lineCount('', 100, s)).toBe(0);
  });

  it('breaks a word too long for the box inside the word', () => {
    const s = { font: 'Manrope' as const, size: 10 };
    expect(lineCount('x'.repeat(40), textWidth('x'.repeat(10), s), s)).toBe(4);
  });
});
