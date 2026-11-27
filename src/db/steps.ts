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
    name: 'customers, sites and jobs',
    run(ctx) {
      // A structured address: free lines, then suburb, city, province, country.
      const address = `address_lines TEXT,
  suburb TEXT,
  city TEXT,
  province TEXT,
  country TEXT`;
      // Customers, Sites and Jobs are never deleted, only archived (spec section 5 and 12).
      // A Job's Site must belong to the Job's Customer. A Job's status is worked out from its events.
      ctx.exec(`
CREATE TABLE customer (
  ${recordColumns()},
  kind TEXT NOT NULL CHECK (kind IN ('person', 'organisation')),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phones TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(phones) AND json_type(phones) = 'array'),
  whatsapp TEXT,
  email TEXT,
  ${address},
  tax_number TEXT,
  archived_at TEXT
) STRICT;
CREATE TABLE customer_note (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  note_date TEXT NOT NULL
) STRICT;
CREATE INDEX customer_note_customer ON customer_note (customer_id);
CREATE TABLE follow_up (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  due_date TEXT NOT NULL,
  done_at TEXT
) STRICT;
CREATE INDEX follow_up_customer ON follow_up (customer_id);
CREATE TABLE site (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  ${address},
  contact_name TEXT,
  contact_phone TEXT,
  archived_at TEXT,
  UNIQUE (id, customer_id)
) STRICT;
CREATE INDEX site_customer ON site (customer_id);
CREATE TABLE job (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  site_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  archived_at TEXT,
  FOREIGN KEY (site_id, customer_id) REFERENCES site (id, customer_id)
) STRICT;
CREATE INDEX job_customer ON job (customer_id);
CREATE TABLE job_event (
  ${recordColumns()},
  job_id TEXT NOT NULL REFERENCES job (id),
  event TEXT NOT NULL CHECK (event IN ('opened', 'done', 'dropped', 'reopened')),
  finished_on TEXT,
  CHECK ((event = 'done') = (finished_on IS NOT NULL))
) STRICT;
CREATE INDEX job_event_job ON job_event (job_id);
`);
    },
  },
];
