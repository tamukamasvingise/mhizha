// Helpers for tests over real records on Node's SQLite. Not used by the app.
import { openDatabase, type Db } from './db';
import { nodePlatform } from './db/node';

let n = 0;
/** Different bytes on every call, as a real random source gives. */
export function countingBytes(k: number): Uint8Array {
  let c = ++n;
  const b = new Uint8Array(k);
  for (let i = k - 1; i >= 0; i--) {
    b[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return b;
}

/** New records at the latest version, with a clock the test can move. */
export function freshDb(clock: () => number = Date.now): Db {
  const opened = openDatabase({ platform: nodePlatform(), appVersion: '1.0.0', random: countingBytes, clock });
  if (!opened.ok) throw new Error(`open failed: ${opened.problem}`);
  return opened.db;
}
