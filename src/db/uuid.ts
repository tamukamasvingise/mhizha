// UUID v7 (RFC 9562): 48 bits of Unix milliseconds, then random bits, so IDs
// made later sort later. `random(n)` returns n random bytes; the app passes
// expo-crypto's, tests pass fixed bytes.

export type RandomBytes = (n: number) => Uint8Array;

export function uuidv7(nowMs: number, random: RandomBytes): string {
  const b = new Uint8Array(16);
  b.set(random(10).subarray(0, 10), 6);
  let t = Math.floor(nowMs);
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b[6] = 0x70 | (b[6]! & 0x0f);
  b[8] = 0x80 | (b[8]! & 0x3f);
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
