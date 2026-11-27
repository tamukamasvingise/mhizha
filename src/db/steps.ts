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
  /** A new record ID (UUID v7). */
  newId(): string;
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
      for (const table of ['customer', 'customer_note', 'follow_up', 'site', 'job', 'job_event']) {
        ctx.exec(`CREATE TRIGGER ${table}_never_deleted BEFORE DELETE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} records are never deleted'); END;`);
      }
    },
  },
  {
    to: 4,
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
  {
    to: 5,
    name: 'setup: business details, Accounting period, Document numbers, files',
    run(ctx) {
      ctx.exec(`
CREATE TABLE file (
  ${recordColumns()},
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'signature', 'pdf')),
  path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0)
) STRICT;
CREATE TABLE setup (
  ${recordColumns()},
  start_date TEXT NOT NULL,
  app_lock INTEGER NOT NULL DEFAULT 0 CHECK (app_lock IN (0, 1)),
  app_lock_asked INTEGER NOT NULL DEFAULT 0 CHECK (app_lock_asked IN (0, 1)),
  finished_at TEXT
) STRICT;
CREATE TABLE business_details (
  ${recordColumns()},
  effective_from TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  trading_as TEXT NOT NULL DEFAULT '',
  what_we_do TEXT NOT NULL DEFAULT '',
  phones TEXT NOT NULL DEFAULT '[]',
  email TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  suburb TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  tax_number TEXT NOT NULL DEFAULT '',
  logo_file_id TEXT REFERENCES file (id),
  brand_colour TEXT NOT NULL,
  font TEXT NOT NULL,
  watermark INTEGER NOT NULL DEFAULT 0 CHECK (watermark IN (0, 1)),
  bank_name TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  mobile_money TEXT NOT NULL DEFAULT '',
  signature_file_id TEXT REFERENCES file (id),
  time_zone TEXT NOT NULL
) STRICT;
CREATE INDEX business_details_from ON business_details (effective_from);
CREATE TABLE accounting_period_setting (
  ${recordColumns()},
  effective_from TEXT NOT NULL UNIQUE,
  every INTEGER NOT NULL CHECK (every IN (1, 3, 12)),
  year_starts INTEGER NOT NULL CHECK (year_starts BETWEEN 1 AND 12)
) STRICT;
CREATE TABLE document_counter (
  ${recordColumns()},
  type TEXT NOT NULL UNIQUE CHECK (type IN ('QUO', 'INV', 'REC', 'REF')),
  prefix TEXT NOT NULL,
  starting_number INTEGER NOT NULL CHECK (starting_number >= 1),
  last_number INTEGER CHECK (last_number IS NULL OR last_number >= starting_number)
) STRICT;
CREATE TRIGGER document_counter_locked BEFORE UPDATE OF prefix, starting_number ON document_counter
WHEN OLD.last_number IS NOT NULL AND (NEW.prefix IS NOT OLD.prefix OR NEW.starting_number IS NOT OLD.starting_number)
BEGIN SELECT RAISE(ABORT, 'Document numbers are locked once one is Issued'); END;
`);
      const now = ctx.now();
      ['QUO', 'INV', 'REC', 'REF'].forEach((type) =>
        ctx.run(
          `INSERT INTO document_counter (id, install_id, created_at, changed_at, type, prefix, starting_number)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [ctx.newId(), ctx.installId, now, now, type, type],
        ),
      );
    },
  },
];
