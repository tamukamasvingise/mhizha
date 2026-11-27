import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db';
import { nodePlatform } from '../db/node';
import { VERSION_FILE_URL } from './site';
import { autoCheck, autoCheckOn, checkNow, dismissUpdate, lastChecked, setAutoCheck, updateBanner, type Fetch } from './updates';

let counter = 0;
const random = (n: number) => {
  let c = ++counter;
  const b = new Uint8Array(n);
  for (let i = n - 1; i >= 0; i--) {
    b[i] = c % 256;
    c = Math.floor(c / 256);
  }
  return b;
};

let db: Db;
beforeEach(() => {
  const opened = openDatabase({ platform: nodePlatform(), appVersion: '1.0.0', clock: () => Date.UTC(2026, 10, 27, 12), random });
  if (!opened.ok) throw new Error(opened.problem);
  db = opened.db;
});

/** A site whose version file says `version`, recording every request. */
function site(body: string | Error, status = 200) {
  const calls: unknown[][] = [];
  const fetch: Fetch = async (...args) => {
    calls.push(args);
    if (body instanceof Error) throw body;
    return { ok: status >= 200 && status < 300, text: async () => body };
  };
  return { fetch, calls };
}
const says = (version: string) => site(JSON.stringify({ version }));

describe('Check for updates', () => {
  it('finds a newer version and shows the Home banner for it', async () => {
    const s = says('1.2.0');
    expect(await checkNow(db, { fetch: s.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'newer', version: '1.2.0' });
    expect(updateBanner(db, '1.0.0')).toBe('1.2.0');
  });

  it('says the app is up to date when the file has this version', async () => {
    const s = says('1.0.0');
    expect(await checkNow(db, { fetch: s.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'up-to-date' });
    expect(updateBanner(db, '1.0.0')).toBeNull();
  });

  it('fails in plain terms with no internet or no version file', async () => {
    for (const s of [site(new Error('Network request failed')), site('Not found', 404), site('<html></html>')])
      expect(await checkNow(db, { fetch: s.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'failed' });
    expect(updateBanner(db, '1.0.0')).toBeNull();
  });

  it('sends nothing about the User: only the version file address is asked for', async () => {
    const s = says('1.2.0');
    await checkNow(db, { fetch: s.fetch, today: '2026-11-27', current: '1.0.0' });
    expect(s.calls).toEqual([[VERSION_FILE_URL]]);
  });
});

describe('the automatic check', () => {
  it('is on unless turned off in Settings', () => {
    expect(autoCheckOn(db)).toBe(true);
    setAutoCheck(db, false);
    expect(autoCheckOn(db)).toBe(false);
    setAutoCheck(db, true);
    expect(autoCheckOn(db)).toBe(true);
  });

  it('runs at most once a day', async () => {
    const s = says('1.0.0');
    const o = { fetch: s.fetch, current: '1.0.0' };
    expect(await autoCheck(db, { ...o, today: '2026-11-27' })).toEqual({ kind: 'up-to-date' });
    expect(await autoCheck(db, { ...o, today: '2026-11-27' })).toEqual({ kind: 'skipped' });
    expect(s.calls).toHaveLength(1);
    expect(await autoCheck(db, { ...o, today: '2026-11-28' })).toEqual({ kind: 'up-to-date' });
    expect(s.calls).toHaveLength(2);
  });

  it('tries again on the next open when there was no internet', async () => {
    const off = site(new Error('Network request failed'));
    expect(await autoCheck(db, { fetch: off.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'failed' });
    const on = says('1.2.0');
    expect(await autoCheck(db, { fetch: on.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'newer', version: '1.2.0' });
  });

  it('does not run when turned off', async () => {
    setAutoCheck(db, false);
    const s = says('1.2.0');
    expect(await autoCheck(db, { fetch: s.fetch, today: '2026-11-27', current: '1.0.0' })).toEqual({ kind: 'skipped' });
    expect(s.calls).toHaveLength(0);
  });
});

describe('the Home banner', () => {
  const found = async (version: string) =>
    checkNow(db, { fetch: says(version).fetch, today: '2026-11-27', current: '1.0.0' });

  it('stays until the User updates', async () => {
    await found('1.2.0');
    expect(updateBanner(db, '1.0.0')).toBe('1.2.0');
    expect(updateBanner(db, '1.2.0')).toBeNull();
    expect(updateBanner(db, '1.3.0')).toBeNull();
  });

  it('stays away once dismissed for that version, and comes back for the next one', async () => {
    await found('1.2.0');
    dismissUpdate(db, '1.2.0');
    expect(updateBanner(db, '1.0.0')).toBeNull();
    await found('1.2.0');
    expect(updateBanner(db, '1.0.0')).toBeNull();
    await found('1.3.0');
    expect(updateBanner(db, '1.0.0')).toBe('1.3.0');
  });

  it('keeps the newest version found even if a later check fails', async () => {
    await found('1.2.0');
    await checkNow(db, { fetch: site(new Error('offline')).fetch, today: '2026-11-28', current: '1.0.0' });
    expect(updateBanner(db, '1.0.0')).toBe('1.2.0');
  });
});

describe('the last check', () => {
  it('is the day the site was last reached', async () => {
    expect(lastChecked(db)).toBeNull();
    await checkNow(db, { fetch: says('1.0.0').fetch, today: '2026-11-27', current: '1.0.0' });
    await checkNow(db, { fetch: site(new Error('offline')).fetch, today: '2026-11-28', current: '1.0.0' });
    expect(lastChecked(db)).toBe('2026-11-27');
  });
});
