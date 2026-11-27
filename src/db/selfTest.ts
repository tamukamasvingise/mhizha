// Runs the database checks on the real expo-sqlite, inside the `.test` app,
// for the emulator job. Each check gets its own files, apart from the real
// records, and they are deleted afterwards.
import { dbChecks } from './checks';
import { DATABASE_NAME } from './database';
import { expoPlatform } from './expo';

export type SelfTestResult = { passed: number; failed: { name: string; error: string }[] };

export function runDbSelfTest(): SelfTestResult {
  const result: SelfTestResult = { passed: 0, failed: [] };
  dbChecks.forEach((check, i) => {
    const platform = expoPlatform(`selftest-${i}-`);
    const clean = () => [DATABASE_NAME, `${DATABASE_NAME}.before-upgrade`].forEach((n) => platform.remove(n));
    clean();
    try {
      check.run(platform);
      result.passed++;
    } catch (e) {
      result.failed.push({ name: check.name, error: e instanceof Error ? e.message : String(e) });
    } finally {
      clean();
    }
  });
  return result;
}
