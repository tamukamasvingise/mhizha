// The problem report (spec section 13): one plain-text file the User sends
// through the Share menu. It holds versions, the phone, the error and upgrade
// logs, the check results and record counts. Never Customer details: records
// appear only as IDs and counts, and the logs already leave out contents.
import type { Db } from '../db';
import { recordCounts, runChecks, type CheckResult } from './checks';

export type Phone = { model: string; manufacturer: string; android: string; api: number | null };

export type ReportFacts = {
  /** The records, or null if they could not be opened at all. */
  db: Db | null;
  made: Date;
  /** The phone's date today, YYYY-MM-DD. */
  localDate: string;
  appVersion: string;
  build: string;
  phone: Phone;
};

export type ProblemReport = { fileName: string; text: string };

export function reportFileName(localDate: string): string {
  return `Mhizha problem report ${localDate}.txt`;
}

const OUTCOME: Record<CheckResult['outcome'], string> = { passed: 'passed', failed: 'failed', waiting: 'waiting' };

function safely(lines: () => string[]): string[] {
  try {
    return lines();
  } catch {
    return ['  (could not be read)'];
  }
}

function checkLines(db: Db): string[] {
  return runChecks(db).flatMap((r) => {
    const head = `  ${OUTCOME[r.outcome].padEnd(7)} ${r.name}`;
    if (r.outcome === 'waiting') return [`${head} (not checked yet: ${r.waitingFor})`];
    return [head, ...r.problems.map((p) => `            ${p}`)];
  });
}

function countLines(db: Db): string[] {
  const counts = Object.entries(recordCounts(db));
  const width = Math.max(0, ...counts.map(([t]) => t.length));
  return counts.map(([t, n]) => `  ${t.padEnd(width)} ${n}`);
}

export function problemReport(f: ReportFacts): ProblemReport {
  const { db, phone } = f;
  const out: string[] = [
    'Mhizha problem report',
    `Made ${f.made.toISOString()} (UTC)`,
    'This report holds no Customer details: only versions, logs, check results and record counts.',
    '',
    'Versions',
    `  Mhizha ${f.appVersion} (build ${f.build})`,
  ];
  if (db) out.push(`  Database version: ${db.version} of ${db.latestVersion}`, `  Install ID: ${db.installId}`);
  out.push(
    '',
    'Phone',
    `  ${phone.manufacturer} ${phone.model}`.trimEnd(),
    `  Android ${phone.android}${phone.api === null ? '' : ` (API ${phone.api})`}`,
    '',
  );

  if (!db) {
    out.push('The records could not be opened.', '');
    return { fileName: reportFileName(f.localDate), text: out.join('\n') };
  }

  out.push('Checks', ...safely(() => checkLines(db)), '');
  out.push('Record counts', ...safely(() => countLines(db)), '');
  out.push(
    'Error log (oldest first)',
    ...safely(() => {
      const log = db.errorLog();
      return log.length
        ? log.map((e) => `  ${e.at}  app ${e.appVersion}  db ${e.dbVersion}  ${e.place}: ${e.error}`)
        : ['  (empty)'];
    }),
    '',
    'Upgrade log',
    ...safely(() =>
      db.upgradeLog().map((u) => `  ${u.from} -> ${u.to}  ${u.startedAt} to ${u.finishedAt}  ${u.result}`),
    ),
    '',
  );
  return { fileName: reportFileName(f.localDate), text: out.join('\n') };
}
