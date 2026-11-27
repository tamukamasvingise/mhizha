// The update check: Check for updates in Settings, the automatic check at most
// once a day when the app opens, and the Home banner for a newer version.
// Plain TypeScript over `Db`; the network is passed in. Only the version file
// is asked for: nothing about the User is sent.
import type { Db, Row } from '../db';
import type { PlainDate } from '../setup/dates';
import { isNewer, parseVersionFile, VERSION_FILE_URL } from './site';

/** The part of `fetch` the check uses. It is called with the address alone. */
export type Fetch = (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>;

export type CheckResult = { kind: 'newer'; version: string } | { kind: 'up-to-date' } | { kind: 'failed' };

export type CheckOptions = { fetch: Fetch; today: PlainDate; current: string };

function row(db: Db): Row {
  const found = db.get('SELECT * FROM update_check ORDER BY rowid LIMIT 1');
  if (found) return found;
  db.insert('update_check', {});
  return db.get('SELECT * FROM update_check ORDER BY rowid LIMIT 1')!;
}

/** Whether the automatic check is on. It is unless turned off in Settings. */
export function autoCheckOn(db: Db): boolean {
  return row(db).automatic === 1;
}

export function setAutoCheck(db: Db, on: boolean): void {
  db.update('update_check', String(row(db).id), { automatic: on ? 1 : 0 });
}

/** The day the site was last reached, or null if never. */
export function lastChecked(db: Db): PlainDate | null {
  const d = row(db).last_checked;
  return typeof d === 'string' ? d : null;
}

/** Reads the version file and keeps the newest version found. */
export async function checkNow(db: Db, o: CheckOptions): Promise<CheckResult> {
  let latest: string;
  try {
    const res = await o.fetch(VERSION_FILE_URL);
    const file = res.ok ? parseVersionFile(await res.text()) : null;
    if (!file) return { kind: 'failed' };
    latest = file.version;
  } catch {
    return { kind: 'failed' };
  }
  const r = row(db);
  const kept = typeof r.latest_version === 'string' && isNewer(r.latest_version, latest) ? r.latest_version : latest;
  db.update('update_check', String(r.id), { last_checked: o.today, latest_version: kept });
  return isNewer(latest, o.current) ? { kind: 'newer', version: latest } : { kind: 'up-to-date' };
}

/** The check when the app opens: skipped if turned off or the site was already reached today. */
export async function autoCheck(db: Db, o: CheckOptions): Promise<CheckResult | { kind: 'skipped' }> {
  const r = row(db);
  if (r.automatic !== 1 || r.last_checked === o.today) return { kind: 'skipped' };
  return checkNow(db, o);
}

/** The version the Home banner offers, or null: none newer than `current`, or the User dismissed it. */
export function updateBanner(db: Db, current: string): string | null {
  const r = row(db);
  const latest = typeof r.latest_version === 'string' ? r.latest_version : null;
  if (!latest || !isNewer(latest, current) || r.dismissed_version === latest) return null;
  return latest;
}

/** Hides the banner for this version; a later version shows it again. */
export function dismissUpdate(db: Db, version: string): void {
  db.update('update_check', String(row(db).id), { dismissed_version: version });
}
