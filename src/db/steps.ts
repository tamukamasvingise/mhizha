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

// Step 8 adds a Quotation's Deposit asked and lead time; they lock too.
const LOCKED_DOCUMENT_COLUMNS_8 = [...LOCKED_DOCUMENT_COLUMNS, 'deposit_asked', 'lead_time'] as const;

// The chart of accounts as step 7 writes it. Released steps never change, so
// this is a copy, not src/core's live list (a test keeps the two in step).
export const ACCOUNTS_AT_STEP_7: Record<string, { name: string; normal: 'debit' | 'credit'; perCustomer: boolean; hidden: boolean }> = {
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
    name: 'update check',
    run(ctx) {
      // One row: whether the daily check is on, the day it last reached the
      // site, the newest version it found and the version the User dismissed.
      ctx.exec(`
CREATE TABLE update_check (
  ${recordColumns()},
  automatic INTEGER NOT NULL DEFAULT 1 CHECK (automatic IN (0, 1)),
  last_checked TEXT,
  latest_version TEXT,
  dismissed_version TEXT
) STRICT;
`);
    },
  },
  {
    to: 7,
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
      for (const [code, a] of Object.entries(ACCOUNTS_AT_STEP_7)) {
        ctx.run(
          `INSERT INTO account (id, install_id, created_at, changed_at, code, name, normal, per_customer, hidden)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ctx.newId(), ctx.installId, now, now, code, a.name, a.normal, a.perCustomer ? 1 : 0, a.hidden ? 1 : 0],
        );
      }
    },
  },
  {
    to: 8,
    name: 'quotations: Deposit asked, lead time and answers',
    run(ctx) {
      // A Quotation can carry the Deposit asked (cents) and a lead time; both
      // lock at issue, so the lock is made again with them in it.
      ctx.exec(`
ALTER TABLE document ADD COLUMN deposit_asked INTEGER CHECK (deposit_asked IS NULL OR deposit_asked > 0);
ALTER TABLE document ADD COLUMN lead_time TEXT NOT NULL DEFAULT '';
CREATE INDEX document_quotation ON document (quotation_id);
CREATE INDEX document_revises ON document (revises_id);
DROP TRIGGER document_issued_locked;
CREATE TRIGGER document_issued_locked BEFORE UPDATE ON document
WHEN OLD.number IS NOT NULL AND (${LOCKED_DOCUMENT_COLUMNS_8.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ')}
  OR (OLD.pdf_file_id IS NOT NULL AND NEW.pdf_file_id IS NOT OLD.pdf_file_id))
BEGIN SELECT RAISE(ABORT, 'An Issued Document is locked'); END;
`);
      // What the User records about an Issued Quotation, as facts: Accepted or
      // Declined on a date, acceptance undone, or Cancelled with a reason. The
      // latest fact wins; none is ever changed or deleted.
      ctx.exec(`
CREATE TABLE quotation_event (
  ${recordColumns()},
  document_id TEXT NOT NULL REFERENCES document (id),
  kind TEXT NOT NULL CHECK (kind IN ('accepted', 'declined', 'undone', 'cancelled')),
  event_date TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  reason TEXT NOT NULL DEFAULT '',
  CHECK (kind <> 'cancelled' OR length(trim(reason)) > 0)
) STRICT;
CREATE INDEX quotation_event_document ON quotation_event (document_id);
CREATE TRIGGER quotation_event_issued_only BEFORE INSERT ON quotation_event
WHEN (SELECT type = 'QUO' AND number IS NOT NULL FROM document WHERE id = NEW.document_id) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'Only an Issued Quotation can be answered'); END;
CREATE TRIGGER quotation_event_never_deleted BEFORE DELETE ON quotation_event
BEGIN SELECT RAISE(ABORT, 'quotation_event records are never deleted'); END;
CREATE TRIGGER quotation_event_never_changed BEFORE UPDATE ON quotation_event
BEGIN SELECT RAISE(ABORT, 'quotation_event records are never changed'); END;
`);
    },
  },
  {
    to: 9,
    name: 'Payment methods, Payments, allocations and Receipt lines',
    run(ctx) {
      // Payments (spec sections 6 and 9). A Payment is saved with its Receipt
      // (a Document of type REC, issued at once), the lines that Receipt
      // prints, and the allocations that say what the money paid. None of
      // these is ever changed or deleted; a mistake is put right by a
      // reversing record (Cancel, a later ticket). Hiding a Payment method is
      // a dated change; the latest one counts.
      ctx.exec(`
CREATE TABLE payment_method (
  ${recordColumns()},
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  money_account_code TEXT NOT NULL REFERENCES account (code),
  needs_description INTEGER NOT NULL CHECK (needs_description IN (0, 1))
) STRICT;
CREATE TABLE payment_method_change (
  ${recordColumns()},
  method_code TEXT NOT NULL REFERENCES payment_method (code),
  hidden INTEGER NOT NULL CHECK (hidden IN (0, 1)),
  effective_from TEXT NOT NULL
) STRICT;
CREATE TABLE payment (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  receipt_id TEXT NOT NULL UNIQUE REFERENCES document (id),
  date_received TEXT NOT NULL,
  method_code TEXT NOT NULL REFERENCES payment_method (code),
  other_description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount > 0),
  separate_receipts INTEGER NOT NULL CHECK (separate_receipts IN (0, 1)),
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id)
) STRICT;
CREATE INDEX payment_customer ON payment (customer_id);
CREATE TABLE allocation (
  ${recordColumns()},
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('payment', 'deposit', 'credit', 'opening-credit')),
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL CHECK (to_kind IN ('invoice', 'opening-balance', 'quotation', 'credit')),
  to_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reverses_id TEXT UNIQUE REFERENCES allocation (id)
) STRICT;
CREATE INDEX allocation_to ON allocation (to_id);
CREATE INDEX allocation_from ON allocation (from_id);
CREATE TABLE receipt_line (
  ${recordColumns()},
  receipt_id TEXT NOT NULL REFERENCES document (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  invoice_id TEXT REFERENCES document (id),
  opening_balance_id TEXT,
  job_id TEXT REFERENCES job (id),
  applied_to TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL CHECK (total > 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  balance_left INTEGER NOT NULL CHECK (balance_left >= 0),
  UNIQUE (receipt_id, position)
) STRICT;
CREATE INDEX receipt_line_receipt ON receipt_line (receipt_id);
`);
      for (const table of ['payment_method', 'payment_method_change', 'payment', 'allocation', 'receipt_line']) {
        ctx.exec(`CREATE TRIGGER ${table}_never_deleted BEFORE DELETE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} records are never deleted'); END;`);
      }
      for (const table of ['payment_method_change', 'payment', 'allocation', 'receipt_line']) {
        ctx.exec(`CREATE TRIGGER ${table}_never_changed BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} records are never changed'); END;`);
      }
      const now = ctx.now();
      const methods: [string, string, string, number][] = [
        ['cash', 'Cash', '1010', 0],
        ['bank-transfer', 'Bank transfer', '1020', 0],
        ['card', 'Card (swipe)', '1020', 0],
        ['ecocash', 'EcoCash', '1030', 0],
        ['innbucks', 'InnBucks', '1040', 0],
        ['other', 'Other', '1090', 1],
      ];
      for (const [code, name, account, describe] of methods) {
        ctx.run(
          `INSERT INTO payment_method (id, install_id, created_at, changed_at, code, name, money_account_code, needs_description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [ctx.newId(), ctx.installId, now, now, code, name, account, describe],
        );
      }
    },
  },
  {
    to: 10,
    name: 'Opening balances and sales before the Start date',
    run(ctx) {
      // Opening balances (spec section 8): what a Customer owed, or the
      // Business held for them, on the Start date. An item is not a Document.
      // Its ledger entries name it as their source ('opening-balance'). It is
      // never changed or deleted, except that it may be Cancelled once, with
      // a reason (the reversing entry is posted in the same save).
      const locked = ['customer_id', 'kind', 'old_number', 'old_date', 'amount', 'note', 'job_id', 'install_id', 'created_at'];
      ctx.exec(`
CREATE TABLE opening_balance_item (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  kind TEXT NOT NULL CHECK (kind IN ('owed', 'credit')),
  old_number TEXT NOT NULL DEFAULT '',
  old_date TEXT CHECK (old_date IS NULL OR old_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  job_id TEXT REFERENCES job (id),
  cancelled_on TEXT CHECK (cancelled_on IS NULL OR cancelled_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  cancel_reason TEXT NOT NULL DEFAULT '',
  CHECK (cancelled_on IS NULL OR length(trim(cancel_reason)) > 0)
) STRICT;
CREATE INDEX opening_balance_item_customer ON opening_balance_item (customer_id);
CREATE TRIGGER opening_balance_item_never_deleted BEFORE DELETE ON opening_balance_item
BEGIN SELECT RAISE(ABORT, 'opening_balance_item records are never deleted'); END;
CREATE TRIGGER opening_balance_item_locked BEFORE UPDATE ON opening_balance_item
WHEN OLD.cancelled_on IS NOT NULL OR ${locked.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ')}
BEGIN SELECT RAISE(ABORT, 'An Opening balance item can only be Cancelled'); END;
`);
      // Sales before the Start date: one total per month (YYYY-MM), used only
      // by the VAT threshold warning. Posts nothing; a blank month is NULL.
      ctx.exec(`
CREATE TABLE sales_before_start (
  ${recordColumns()},
  month TEXT NOT NULL UNIQUE CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount INTEGER CHECK (amount IS NULL OR amount >= 0)
) STRICT;
CREATE TRIGGER sales_before_start_never_deleted BEFORE DELETE ON sales_before_start
BEGIN SELECT RAISE(ABORT, 'sales_before_start records are never deleted'); END;
`);
    },
  },
  {
    to: 11,
    name: 'Refunds, and allocations that can go to a Refund',
    run(ctx) {
      // A Refund (spec section 6) returns unused Deposit or Credit: a locked
      // Document of type REF, with this record of what was paid back, when,
      // how and why. What it used is allocations to the Refund from the
      // Deposit or Credit it took the money from. SQLite cannot change a
      // CHECK, so allocation is made again with 'refund' as a place money
      // goes, every row copied as it was.
      ctx.exec(`
DROP TRIGGER allocation_never_deleted;
DROP TRIGGER allocation_never_changed;
CREATE TABLE allocation_new (
  ${recordColumns()},
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('payment', 'deposit', 'credit', 'opening-credit')),
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL CHECK (to_kind IN ('invoice', 'opening-balance', 'quotation', 'credit', 'refund')),
  to_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reverses_id TEXT UNIQUE REFERENCES allocation_new (id)
) STRICT;
INSERT INTO allocation_new (id, install_id, created_at, changed_at, change_count, journal_entry_id, from_kind, from_id, to_kind, to_id, amount, reverses_id)
  SELECT id, install_id, created_at, changed_at, change_count, journal_entry_id, from_kind, from_id, to_kind, to_id, amount, reverses_id
  FROM allocation ORDER BY rowid;
DROP TABLE allocation;
ALTER TABLE allocation_new RENAME TO allocation;
CREATE INDEX allocation_to ON allocation (to_id);
CREATE INDEX allocation_from ON allocation (from_id);
CREATE TRIGGER allocation_never_deleted BEFORE DELETE ON allocation
BEGIN SELECT RAISE(ABORT, 'allocation records are never deleted'); END;
CREATE TRIGGER allocation_never_changed BEFORE UPDATE ON allocation
BEGIN SELECT RAISE(ABORT, 'allocation records are never changed'); END;
CREATE TABLE refund (
  ${recordColumns()},
  customer_id TEXT NOT NULL REFERENCES customer (id),
  document_id TEXT NOT NULL UNIQUE REFERENCES document (id),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('deposit', 'credit')),
  quotation_id TEXT REFERENCES document (id),
  refund_date TEXT NOT NULL CHECK (refund_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  method_code TEXT NOT NULL REFERENCES payment_method (code),
  other_description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  journal_entry_id TEXT NOT NULL REFERENCES journal_entry (id),
  CHECK ((from_kind = 'deposit') = (quotation_id IS NOT NULL))
) STRICT;
CREATE INDEX refund_customer ON refund (customer_id);
CREATE TRIGGER refund_never_deleted BEFORE DELETE ON refund
BEGIN SELECT RAISE(ABORT, 'refund records are never deleted'); END;
CREATE TRIGGER refund_never_changed BEFORE UPDATE ON refund
BEGIN SELECT RAISE(ABORT, 'refund records are never changed'); END;
`);
    },
  },
];
