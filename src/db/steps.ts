// The numbered upgrade steps. Forward only: a released step is never edited or
// removed; a change is a new step with the next number. Steps never delete the
// User's records.
import type { SqlValue } from './sql';

// Every column of an Issued Document that may never change. Only its PDF file
// may be set, once, after issuing.
const LOCKED_DOCUMENT_COLUMNS = [
  'type', 'customer_id', 'job_id', 'number', 'printed_number', 'revision', 'revises_id', 'quotation_id',
  'issued_at', 'time_zone', 'issue_date', 'valid_until', 'due_date', 'order_no', 'tax_status', 'vat_rate',
  'vat_amount', 'subtotal', 'discount_kind', 'discount_value', 'discount_cents', 'total', 'sum_in_words',
  'frozen', 'deleted_at', 'install_id', 'created_at',
] as const;

// The chart of accounts as step 6 writes it. Released steps never change, so
// this is a copy, not src/core's live list (a test keeps the two in step).
export const ACCOUNTS_AT_STEP_6: Record<string, { name: string; normal: 'debit' | 'credit'; perCustomer: boolean; hidden: boolean }> = {
  '1010': { name: 'Cash', normal: 'debit', perCustomer: false, hidden: false },
  '1020': { name: 'Bank', normal: 'debit', perCustomer: false, hidden: false },
  '1030': { name: 'EcoCash', normal: 'debit', perCustomer: false, hidden: false },
  '1040': { name: 'InnBucks', normal: 'debit', perCustomer: false, hidden: false },
  '1090': { name: 'Other money', normal: 'debit', perCustomer: false, hidden: false },
  '1100': { name: 'Customers owe', normal: 'debit', perCustomer: true, hidden: false },
  '1200': { name: 'Unbilled work', normal: 'debit', perCustomer: false, hidden: true },
  '2100': { name: 'Deposits held', normal: 'credit', perCustomer: true, hidden: false },
  '2200': { name: 'Credit held', normal: 'credit', perCustomer: true, hidden: false },
  '2300': { name: 'Unearned income', normal: 'credit', perCustomer: false, hidden: true },
  '3000': { name: "Owner's equity", normal: 'credit', perCustomer: false, hidden: false },
  '3100': { name: 'Opening balances', normal: 'credit', perCustomer: false, hidden: false },
  '4000': { name: 'Sales', normal: 'credit', perCustomer: false, hidden: false },
  '5000': { name: 'Bad debts', normal: 'debit', perCustomer: false, hidden: false },
};

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
  {
    to: 6,
    name: 'documents, lines, accounts and the journal',
    run(ctx) {
      // Documents (spec sections 6 and 12). A Draft has no number and may be
      // deleted (a marker; nothing is erased). Issuing gives the number and
      // locks the Document: after that only its PDF file may be set, once.
      ctx.exec(`
CREATE TABLE document (
  ${recordColumns({ deletable: true })},
  type TEXT NOT NULL CHECK (type IN ('QUO', 'INV', 'REC', 'REF')),
  customer_id TEXT NOT NULL REFERENCES customer (id),
  job_id TEXT REFERENCES job (id),
  number INTEGER CHECK (number IS NULL OR number >= 1),
  printed_number TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  revises_id TEXT REFERENCES document (id),
  quotation_id TEXT REFERENCES document (id),
  issued_at TEXT,
  time_zone TEXT,
  issue_date TEXT,
  valid_until TEXT,
  due_date TEXT,
  order_no TEXT NOT NULL DEFAULT '',
  tax_status TEXT CHECK (tax_status IS NULL OR tax_status IN ('not registered')),
  vat_rate INTEGER,
  vat_amount INTEGER,
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_kind TEXT CHECK (discount_kind IS NULL OR discount_kind IN ('amount', 'percent')),
  discount_value INTEGER CHECK (discount_value IS NULL OR discount_value >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0 AND discount_cents <= subtotal),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  sum_in_words TEXT,
  frozen TEXT CHECK (frozen IS NULL OR json_valid(frozen)),
  pdf_file_id TEXT REFERENCES file (id),
  CHECK ((discount_kind IS NULL) = (discount_value IS NULL)),
  CHECK (total = subtotal - discount_cents),
  CHECK (number IS NULL OR (printed_number IS NOT NULL AND issued_at IS NOT NULL AND time_zone IS NOT NULL
    AND issue_date IS NOT NULL AND tax_status IS NOT NULL AND total > 0 AND sum_in_words IS NOT NULL
    AND frozen IS NOT NULL AND deleted_at IS NULL)),
  UNIQUE (type, number, revision)
) STRICT;
CREATE INDEX document_customer ON document (customer_id);
CREATE INDEX document_job ON document (job_id);
CREATE TABLE document_line (
  ${recordColumns({ deletable: true })},
  document_id TEXT NOT NULL REFERENCES document (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  price_list_item_id TEXT REFERENCES price_list_item (id),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  unit TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  amount INTEGER NOT NULL CHECK (amount >= 0)
) STRICT;
CREATE INDEX document_line_document ON document_line (document_id);
CREATE TRIGGER document_never_deleted BEFORE DELETE ON document
BEGIN SELECT RAISE(ABORT, 'document records are never deleted'); END;
CREATE TRIGGER document_line_never_deleted BEFORE DELETE ON document_line
BEGIN SELECT RAISE(ABORT, 'document_line records are never deleted'); END;
CREATE TRIGGER document_issued_locked BEFORE UPDATE ON document
WHEN OLD.number IS NOT NULL AND (${LOCKED_DOCUMENT_COLUMNS.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ')}
  OR (OLD.pdf_file_id IS NOT NULL AND NEW.pdf_file_id IS NOT OLD.pdf_file_id))
BEGIN SELECT RAISE(ABORT, 'An Issued Document is locked'); END;
CREATE TRIGGER document_line_issued_locked_insert BEFORE INSERT ON document_line
WHEN (SELECT number FROM document WHERE id = NEW.document_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'An Issued Document is locked'); END;
CREATE TRIGGER document_line_issued_locked_update BEFORE UPDATE ON document_line
WHEN (SELECT number FROM document WHERE id = OLD.document_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'An Issued Document is locked'); END;
`);
      // The ledger (spec section 9): accounts with permanent codes, and journal
      // entries that are never changed or deleted.
      ctx.exec(`
CREATE TABLE account (
  ${recordColumns()},
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  normal TEXT NOT NULL CHECK (normal IN ('debit', 'credit')),
  per_customer INTEGER NOT NULL CHECK (per_customer IN (0, 1)),
  hidden INTEGER NOT NULL CHECK (hidden IN (0, 1))
) STRICT;
CREATE TABLE journal_entry (
  ${recordColumns()},
  accounting_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  reverses_id TEXT UNIQUE REFERENCES journal_entry (id),
  adjustment INTEGER NOT NULL DEFAULT 0 CHECK (adjustment IN (0, 1))
) STRICT;
CREATE INDEX journal_entry_source ON journal_entry (source_id);
CREATE TABLE journal_line (
  ${recordColumns()},
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id),
  account_code TEXT NOT NULL REFERENCES account (code),
  customer_id TEXT REFERENCES customer (id),
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0) <> (credit > 0))
) STRICT;
CREATE INDEX journal_line_entry ON journal_line (journal_entry_id);
CREATE INDEX journal_line_customer ON journal_line (customer_id, account_code);
`);
      for (const table of ['account', 'journal_entry', 'journal_line']) {
        ctx.exec(`CREATE TRIGGER ${table}_never_deleted BEFORE DELETE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} records are never deleted'); END;`);
      }
      for (const table of ['journal_entry', 'journal_line']) {
        ctx.exec(`CREATE TRIGGER ${table}_never_changed BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} records are never changed'); END;`);
      }
      const now = ctx.now();
      for (const [code, a] of Object.entries(ACCOUNTS_AT_STEP_6)) {
        ctx.run(
          `INSERT INTO account (id, install_id, created_at, changed_at, code, name, normal, per_customer, hidden)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ctx.newId(), ctx.installId, now, now, code, a.name, a.normal, a.perCustomer ? 1 : 0, a.hidden ? 1 : 0],
        );
      }
    },
  },
];
