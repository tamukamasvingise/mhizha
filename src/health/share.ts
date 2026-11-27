// The problem report on the phone: gathers the facts, writes the file and
// opens the Share menu. App only; the report itself is in report.ts.
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Db } from '../db';
import { problemReport, type Phone, type ProblemReport } from './report';

function phone(): Phone {
  const c = Platform.constants as unknown as Record<string, unknown>;
  return {
    model: String(c.Model ?? 'unknown model'),
    manufacturer: String(c.Manufacturer ?? ''),
    android: String(c.Release ?? Platform.Version),
    api: typeof Platform.Version === 'number' ? Platform.Version : null,
  };
}

const two = (n: number) => String(n).padStart(2, '0');

export function makeReport(db: Db | null): ProblemReport {
  const made = new Date();
  return problemReport({
    db,
    made,
    localDate: `${made.getFullYear()}-${two(made.getMonth() + 1)}-${two(made.getDate())}`,
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    build: String(Constants.expoConfig?.extra?.build ?? ''),
    phone: phone(),
  });
}

/** Writes the report as a .txt file and opens the Share menu. Throws if it cannot. */
export async function shareReport(report: ProblemReport): Promise<void> {
  const file = new File(Paths.cache, report.fileName);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(report.text);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Send the problem report' });
}
