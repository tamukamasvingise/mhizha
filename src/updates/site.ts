// The GitHub Pages site and the version file the update check reads. This is
// the one place their addresses and the file's format are defined; the site
// (ticket 23) publishes the file. Plain TypeScript, free of Expo.
//
// Version file format, served at VERSION_FILE_URL as JSON:
//   { "version": "1.2.0" }
// `version` is the latest released app version, three whole numbers. Other
// fields are ignored, so the site may add some later.

export const SITE_URL = 'https://tamukamasvingise.github.io/mhizha/';
export const VERSION_FILE_URL = `${SITE_URL}version.json`;

export type VersionFile = { version: string };

const VERSION = /^\d+\.\d+\.\d+$/;

/** The version file's contents, or null when the text is not one. */
export function parseVersionFile(text: string): VersionFile | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const version = (data as { version?: unknown }).version;
  return typeof version === 'string' && VERSION.test(version) ? { version } : null;
}

const parts = (v: string) => v.split('.').map(Number);

/** Whether version `a` comes after version `b`. */
export function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** How a version reads to the User: 1.2.0 is "1.2". */
export function shortVersion(v: string): string {
  return v.endsWith('.0') && v.split('.').length === 3 ? v.slice(0, -2) : v;
}
