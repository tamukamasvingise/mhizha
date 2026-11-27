import { describe, expect, it } from 'vitest';
import { signaturePath, signatureSvg } from './signature';

describe('a drawn signature', () => {
  it('turns each stroke into one line of the drawing', () => {
    expect(signaturePath([[{ x: 1, y: 2 }, { x: 3.456, y: 4 }], [{ x: 10, y: 10 }, { x: 12, y: 11 }]])).toBe(
      'M1 2L3.5 4M10 10L12 11',
    );
  });

  it('draws a single tap as a dot', () => {
    expect(signaturePath([[{ x: 5, y: 5 }]])).toBe('M5 5L5.1 5');
  });

  it('is kept as a black drawing on a clear page, the size it was drawn', () => {
    const svg = signatureSvg([[{ x: 0, y: 0 }, { x: 30, y: 20 }]], 300, 120);
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120">' +
        '<path d="M0 0L30 20" fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    );
  });

  it('is empty until something is drawn', () => {
    expect(signatureSvg([], 300, 120)).toBeNull();
  });
});
