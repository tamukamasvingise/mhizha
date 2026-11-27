import { describe, expect, it } from 'vitest';
import { uuidv7 } from './uuid';

const zeros = (n: number) => new Uint8Array(n);
const ones = (n: number) => new Uint8Array(n).fill(0xff);

describe('uuidv7', () => {
  it('puts the time first, then the version and variant (RFC 9562 test vector time)', () => {
    // RFC 9562 appendix A.6: 2022-02-22 19:22:22 UTC is 0x017F22E279B0.
    const id = uuidv7(Date.UTC(2022, 1, 22, 19, 22, 22), zeros);
    expect(id).toBe('017f22e2-79b0-7000-8000-000000000000');
  });

  it('fills the rest from the random bytes', () => {
    expect(uuidv7(0, ones)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
  });

  it('sorts by time as text', () => {
    const a = uuidv7(1_700_000_000_000, ones);
    const b = uuidv7(1_700_000_000_001, zeros);
    expect(a < b).toBe(true);
  });
});
