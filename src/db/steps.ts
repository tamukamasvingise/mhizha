// The numbered upgrade steps. Forward only: a released step is never edited or
// removed; a change is a new step with the next number. Steps never delete the
// User's records.
import type { SqlValue } from './sql';

export type StepContext = {
  exec(sql: string): void;
  run(sql: string, params?: readonly SqlValue[]): void;
  installId: string;
  appVersion: string;
  /** The time now, UTC, ISO 8601. */
  now(): string;
};

export type Step = { to: number; name: string; run(ctx: StepContext): void };

/**
 * The columns every record has: a UUID v7, the install that made it, created
 * and last-changed times (UTC, ISO 8601) and a change counter. Pass
 * `deletable` for tables whose rows may be deleted: they get a deleted marker.
 */
export function recordColumns({ deletable = false } = {}): string {
  return [
    "id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36)",
    "install_id TEXT NOT NULL CHECK (length(install_id) = 36)",
    "created_at TEXT NOT NULL",
    "changed_at TEXT NOT NULL",
    "change_count INTEGER NOT NULL DEFAULT 0 CHECK (change_count >= 0)",
    ...(deletable ? ['deleted_at TEXT'] : []),
  ].join(',\n  ');
}

export const steps: readonly Step[] = [
  {
    to: 1,
    name: 'install, upgrade log and error log',
    run(ctx) {
      ctx.exec(`
CREATE TABLE install (
  ${recordColumns()},
  first_opened_at TEXT NOT NULL,
  app_version TEXT NOT NULL
) STRICT;
CREATE TABLE upgrade_log (
  ${recordColumns()},
  from_version INTEGER NOT NULL,
  to_version INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  result TEXT NOT NULL
) STRICT;
CREATE TABLE error_log (
  ${recordColumns()},
  at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  db_version INTEGER NOT NULL,
  place TEXT NOT NULL,
  error TEXT NOT NULL
) STRICT;
`);
      const now = ctx.now();
      ctx.run(
        'INSERT INTO install (id, install_id, created_at, changed_at, first_opened_at, app_version) VALUES (?, ?, ?, ?, ?, ?)',
        [ctx.installId, ctx.installId, now, now, now, ctx.appVersion],
      );
    },
  },
  {
    to: 2,
    name: 'price list',
    run(ctx) {
      ctx.exec(`
CREATE TABLE price_list_item (
  ${recordColumns({ deletable: true })},
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  unit TEXT NOT NULL DEFAULT '',
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
) STRICT;
`);
    },
  },
  {
    to: 3,
    name: 'check log',
    run(ctx) {
      // One row per run of the checks on open: what each check found and the
      // record counts, so the next open can tell whether records were erased.
      ctx.exec(`
CREATE TABLE check_log (
  ${recordColumns()},
  app_version TEXT NOT NULL,
  db_version INTEGER NOT NULL,
  failed INTEGER NOT NULL CHECK (failed IN (0, 1)),
  results TEXT NOT NULL,
  counts TEXT NOT NULL
) STRICT;
`);
    },
  },
];
