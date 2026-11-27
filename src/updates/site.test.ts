import { describe, expect, it } from 'vitest';
import { isNewer, parseVersionFile, shortVersion, VERSION_FILE_URL } from './site';

describe('the version file', () => {
  it('lives on the GitHub Pages site', () => {
    expect(VERSION_FILE_URL).toBe('https://tamukamasvingise.github.io/mhizha/version.json');
  });

  it('gives the latest version', () => {
    expect(parseVersionFile('{"version":"1.2.0"}')).toEqual({ version: '1.2.0' });
  });

  it('ignores anything that is not a version file', () => {
    expect(parseVersionFile('<html>Not found</html>')).toBeNull();
    expect(parseVersionFile('{"version":"latest"}')).toBeNull();
    expect(parseVersionFile('{"version":12}')).toBeNull();
    expect(parseVersionFile('null')).toBeNull();
  });
});

describe('comparing versions', () => {
  it('compares each part as a number', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('1.1.9', '1.2.0')).toBe(false);
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
  });

  it('shows 1.2.0 as 1.2 and keeps a patch number', () => {
    expect(shortVersion('1.2.0')).toBe('1.2');
    expect(shortVersion('1.2.3')).toBe('1.2.3');
  });
});
