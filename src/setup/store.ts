// The setup records: Business details, Document numbers, the Start date, the
// Accounting period and the App lock. Plain TypeScript over `Db`; the setup
// wizard and Settings both use these.
import type { Db, Row } from '../db';
import { BRAND_COLOURS, parseColour } from './colour';
import { TIME_ZONE, type PlainDate } from './dates';
import { DEFAULT_PERIOD, nextPeriodStart, type PeriodSetting } from './period';

/** A setup rule was broken. The message is plain words for the User. */
export class SetupError extends Error {}

export const FONTS = ['Inter', 'IBM Plex Sans', 'Manrope', 'Source Serif 4'] as const;
export type FontName = (typeof FONTS)[number];

export type Address = {
  line1: string;
  line2: string;
  suburb: string;
  city: string;
  province: string;
  country: string;
};

export type BusinessDetails = {
  name: string;
  tradingAs: string;
  whatWeDo: string;
  phones: string[];
  email: string;
  address: Address;
  taxNumber: string;
  logoFileId: string | null;
  brandColour: string;
  font: FontName;
  watermark: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  mobileMoney: string;
  signatureFileId: string | null;
};

export function emptyBusiness(): BusinessDetails {
  return {
    name: '',
    tradingAs: '',
    whatWeDo: '',
    phones: [],
    email: '',
    address: { line1: '', line2: '', suburb: '', city: '', province: '', country: 'Zimbabwe' },
    taxNumber: '',
    logoFileId: null,
    brandColour: BRAND_COLOURS[0]!.hex,
    font: 'Inter',
    watermark: false,
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    mobileMoney: '',
    signatureFileId: null,
  };
}

export type BusinessProblems = Partial<Record<'name' | 'email' | 'brandColour', string>>;

/** What must be fixed before the details can be saved, by field. Empty when none. */
export function problemsWith(d: BusinessDetails): BusinessProblems {
  const p: BusinessProblems = {};
  if (!d.name.trim()) p.name = 'Enter the name of your business.';
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    p.email = 'Enter an email like name@example.com, or leave it empty.';
  if (!parseColour(d.brandColour)) p.brandColour = 'Enter a colour like #C2410C, or pick one above.';
  return p;
}

export type SetupStatus = 'new' | 'started' | 'done';

function setupRow(db: Db): Row | undefined {
  return db.get('SELECT * FROM setup ORDER BY rowid LIMIT 1');
}

function requireSetup(db: Db): Row {
  const row = setupRow(db);
  if (!row) throw new SetupError('Setup has not started.');
  return row;
}

/** 'new' until Start new; 'started' during the wizard; 'done' after it. */
export function setupStatus(db: Db): SetupStatus {
  const row = setupRow(db);
  if (!row) return 'new';
  return row.finished_at ? 'done' : 'started';
}

/** Start new: the Start date is today and the Accounting period monthly from January. */
export function startNew(db: Db, today: PlainDate): void {
  if (setupRow(db)) return;
  db.transaction(() => {
    db.insert('setup', { start_date: today });
    db.insert('accounting_period_setting', {
      effective_from: today,
      every: DEFAULT_PERIOD.every,
      year_starts: DEFAULT_PERIOD.yearStarts,
    });
  });
}

export function finishSetup(db: Db): void {
  const row = requireSetup(db);
  if (!businessDetails(db)) throw new SetupError('Enter the name of your business first.');
  if (!row.finished_at) db.update('setup', String(row.id), { finished_at: new Date().toISOString() });
}

// --- Business details ---

const toRow = (d: BusinessDetails) => ({
  name: d.name.trim(),
  trading_as: d.tradingAs.trim(),
  what_we_do: d.whatWeDo.trim(),
  phones: JSON.stringify(d.phones.map((p) => p.trim()).filter(Boolean)),
  email: d.email.trim(),
  address_line1: d.address.line1.trim(),
  address_line2: d.address.line2.trim(),
  suburb: d.address.suburb.trim(),
  city: d.address.city.trim(),
  province: d.address.province.trim(),
  country: d.address.country.trim(),
  tax_number: d.taxNumber.trim(),
  logo_file_id: d.logoFileId,
  brand_colour: parseColour(d.brandColour)!,
  font: d.font,
  watermark: d.watermark ? 1 : 0,
  bank_name: d.bankName.trim(),
  account_name: d.accountName.trim(),
  account_number: d.accountNumber.trim(),
  branch: d.branch.trim(),
  mobile_money: d.mobileMoney.trim(),
  signature_file_id: d.signatureFileId,
});

const fromRow = (r: Row): BusinessDetails => ({
  name: String(r.name),
  tradingAs: String(r.trading_as),
  whatWeDo: String(r.what_we_do),
  phones: JSON.parse(String(r.phones)) as string[],
  email: String(r.email),
  address: {
    line1: String(r.address_line1),
    line2: String(r.address_line2),
    suburb: String(r.suburb),
    city: String(r.city),
    province: String(r.province),
    country: String(r.country),
  },
  taxNumber: String(r.tax_number),
  logoFileId: r.logo_file_id == null ? null : String(r.logo_file_id),
  brandColour: String(r.brand_colour),
  font: String(r.font) as FontName,
  watermark: r.watermark === 1,
  bankName: String(r.bank_name),
  accountName: String(r.account_name),
  accountNumber: String(r.account_number),
  branch: String(r.branch),
  mobileMoney: String(r.mobile_money),
  signatureFileId: r.signature_file_id == null ? null : String(r.signature_file_id),
});

/**
 * Saves the details as a new version taking effect `today`. Earlier versions
 * are kept for the dates they applied. Nothing is saved if nothing changed.
 */
export function saveBusinessDetails(db: Db, d: BusinessDetails, today: PlainDate): void {
  const problems = Object.values(problemsWith(d));
  if (problems.length) throw new SetupError(problems[0]);
  const current = businessDetails(db);
  const row = toRow(d);
  if (current && JSON.stringify(toRow(current)) === JSON.stringify(row)) return;
  db.insert('business_details', { effective_from: today, ...row, time_zone: TIME_ZONE });
}

/** The details in effect on `on` (the latest saved when left out), or null before any are saved. */
export function businessDetails(db: Db, on?: PlainDate): BusinessDetails | null {
  const r = on
    ? db.get('SELECT * FROM business_details WHERE effective_from <= ? ORDER BY effective_from DESC, rowid DESC LIMIT 1', [on])
    : db.get('SELECT * FROM business_details ORDER BY effective_from DESC, rowid DESC LIMIT 1');
  return r ? fromRow(r) : null;
}

// --- Files ---

export type FileKind = 'logo' | 'signature' | 'pdf';
export type StoredFile = { kind: FileKind; path: string; checksum: string; size: number };

/** Records a file that has been written. Files are never overwritten: a new picture is a new file. */
export function saveFile(db: Db, f: StoredFile): string {
  return db.insert('file', { kind: f.kind, path: f.path, checksum: f.checksum, size: f.size });
}

export function fileRecord(db: Db, id: string): StoredFile | null {
  const r = db.get('SELECT kind, path, checksum, size FROM file WHERE id = ?', [id]);
  return r ? { kind: r.kind as FileKind, path: String(r.path), checksum: String(r.checksum), size: Number(r.size) } : null;
}

// --- Document numbers ---

export type DocumentType = 'QUO' | 'INV' | 'REC' | 'REF';
export type DocumentCounter = {
  type: DocumentType;
  prefix: string;
  startingNumber: number;
  lastNumber: number | null;
  /** True once the first Document of this type is Issued. */
  locked: boolean;
};

export const DOCUMENT_TYPE_NAMES: Record<DocumentType, string> = {
  QUO: 'Quotations',
  INV: 'Invoices',
  REC: 'Receipts',
  REF: 'Refunds',
};

const ORDER: readonly DocumentType[] = ['QUO', 'INV', 'REC', 'REF'];
export const MAX_STARTING_NUMBER = 999999;

export function documentCounters(db: Db): DocumentCounter[] {
  const rows = db.all('SELECT type, prefix, starting_number, last_number FROM document_counter');
  return rows
    .map((r) => ({
      type: r.type as DocumentType,
      prefix: String(r.prefix),
      startingNumber: Number(r.starting_number),
      lastNumber: r.last_number == null ? null : Number(r.last_number),
      locked: r.last_number != null,
    }))
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
}

/** A printed number: prefix, then at least four digits ("INV-0046"). */
export function formatNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

/** The number the first Document of this type gets. */
export function firstNumber(c: DocumentCounter): string {
  return formatNumber(c.prefix, c.startingNumber);
}

export function setStartingNumber(db: Db, type: DocumentType, n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > MAX_STARTING_NUMBER)
    throw new SetupError(`Enter a whole number from 1 to ${MAX_STARTING_NUMBER}.`);
  const c = documentCounters(db).find((x) => x.type === type);
  if (!c) throw new SetupError('No such Document type.');
  if (c.locked) throw new SetupError(`${DOCUMENT_TYPE_NAMES[type]} have been Issued, so their numbers can no longer change.`);
  const row = db.get('SELECT id FROM document_counter WHERE type = ?', [type])!;
  db.update('document_counter', String(row.id), { starting_number: n });
}

// --- Start date ---

export function startDate(db: Db): PlainDate {
  return String(requireSetup(db).start_date);
}

/** The Start date can be today or earlier, never later. */
export function setStartDate(db: Db, date: PlainDate, today: PlainDate): void {
  if (date > today) throw new SetupError('The Start date cannot be later than today.');
  const row = requireSetup(db);
  db.transaction(() => {
    db.update('setup', String(row.id), { start_date: date });
    // During setup the first Accounting period setting moves with the Start date.
    if (!row.finished_at)
      db.run('UPDATE accounting_period_setting SET effective_from = ? WHERE effective_from = ?', [date, String(row.start_date)]);
  });
}

// --- Accounting period ---

const settingFrom = (r: Row): PeriodSetting => ({ every: Number(r.every) as PeriodSetting['every'], yearStarts: Number(r.year_starts) });

/** The setting in effect on `date`. */
export function periodSetting(db: Db, date: PlainDate): PeriodSetting {
  const r =
    db.get('SELECT every, year_starts FROM accounting_period_setting WHERE effective_from <= ? ORDER BY effective_from DESC LIMIT 1', [date]) ??
    db.get('SELECT every, year_starts FROM accounting_period_setting ORDER BY effective_from LIMIT 1');
  return r ? settingFrom(r) : DEFAULT_PERIOD;
}

/** A change chosen in Settings that starts with the next period, if any. */
export function pendingPeriod(db: Db, today: PlainDate): { setting: PeriodSetting; from: PlainDate } | null {
  const r = db.get('SELECT effective_from, every, year_starts FROM accounting_period_setting WHERE effective_from > ? ORDER BY effective_from DESC LIMIT 1', [today]);
  return r ? { setting: settingFrom(r), from: String(r.effective_from) } : null;
}

/**
 * Chooses how often to review. During setup it applies from the Start date;
 * afterwards from the next period, so past and current periods keep theirs.
 * Returns the date it takes effect.
 */
export function choosePeriod(db: Db, s: PeriodSetting, today: PlainDate): PlainDate {
  if (![1, 3, 12].includes(s.every) || !Number.isInteger(s.yearStarts) || s.yearStarts < 1 || s.yearStarts > 12)
    throw new SetupError('Pick how often, and the month your year starts.');
  const row = requireSetup(db);
  const from = row.finished_at ? nextPeriodStart(today, periodSetting(db, today)) : String(row.start_date);
  const existing = db.get('SELECT id FROM accounting_period_setting WHERE effective_from = ?', [from]);
  if (existing) db.update('accounting_period_setting', String(existing.id), { every: s.every, year_starts: s.yearStarts });
  else db.insert('accounting_period_setting', { effective_from: from, every: s.every, year_starts: s.yearStarts });
  return from;
}

// --- App lock ---

export function appLock(db: Db): boolean {
  return setupRow(db)?.app_lock === 1;
}

/** Whether the setup question about the App lock has been asked. It is asked once. */
export function appLockAsked(db: Db): boolean {
  return setupRow(db)?.app_lock_asked === 1;
}

export function setAppLock(db: Db, on: boolean): void {
  db.update('setup', String(requireSetup(db).id), { app_lock: on ? 1 : 0, app_lock_asked: 1 });
}

export function markAppLockAsked(db: Db): void {
  db.update('setup', String(requireSetup(db).id), { app_lock_asked: 1 });
}
