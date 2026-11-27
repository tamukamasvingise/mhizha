// The app's records in SQLite: opening, upgrading safely, and the rules every
// record follows. Everything else reaches the database through `Db`.
//
// Upgrades (spec section 12): numbered forward-only steps tracked by
// `PRAGMA user_version`, each in its own transaction and logged in
// `upgrade_log`. Before upgrading existing records a safety copy is made with
// `VACUUM INTO` and opened to check it; if a step fails, the records are put
// back from the copy.
import type { Row, SqlConnection, SqlPlatform, SqlValue } from './sql';
import { steps as appSteps, type Step, type StepContext } from './steps';
import { uuidv7, type RandomBytes } from './uuid';

export type OpenOptions = {
  platform: SqlPlatform;
  /** The database file name. */
  name?: string;
  /** The upgrade steps; the app's own unless a test passes others. */
  steps?: readonly Step[];
  appVersion: string;
  /** Milliseconds since 1970, UTC. */
  clock?: () => number;
  random: RandomBytes;
};

export type OpenProblem = 'too-new' | 'copy-failed' | 'returned-to-copy' | 'failed';

export type OpenResult =
  | { ok: true; db: Db; upgraded: { from: number; to: number } | null }
  /** `db` is the records as they were, for the error log and a problem report; the app must not work on them. */
  | { ok: false; problem: OpenProblem; message: string; db: Db | null };

export type UpgradeEntry = { from: number; to: number; startedAt: string; finishedAt: string; result: string };
export type ErrorEntry = { at: string; appVersion: string; dbVersion: number; place: string; error: string };

export interface Db {
  readonly installId: string;
  /** The database version (`PRAGMA user_version`). */
  readonly version: number;
  /** The version the app's steps reach. */
  readonly latestVersion: number;
  get(sql: string, params?: readonly SqlValue[]): Row | undefined;
  all(sql: string, params?: readonly SqlValue[]): Row[];
  run(sql: string, params?: readonly SqlValue[]): { changes: number };
  /** Runs `fn` as one unit: all of it is saved, or none. May be nested. */
  transaction<T>(fn: () => T): T;
  /** Adds a record with a new ID, this install's ID, both times and a change counter of 0. Returns the ID. */
  insert(table: string, values: Record<string, SqlValue>): string;
  /** Changes a record, moving its last-changed time and change counter on. */
  update(table: string, id: string, values: Record<string, SqlValue>): void;
  /**
   * Adds to the error log (last 500 kept). `place` is the screen or job.
   * Refer to records by ID only: never put names, phone numbers, amounts or
   * descriptions in an error. Quoted text in the error is removed.
   */
  logError(place: string, error: unknown): void;
  errorLog(): ErrorEntry[];
  upgradeLog(): UpgradeEntry[];
  close(): void;
}

export const DATABASE_NAME = 'mhizha.db';
export const ERROR_LOG_KEEP = 500;

export const messages: Record<OpenProblem, string> = {
  'too-new': 'These records were made by a newer Mhizha. Install the latest Mhizha, then open it again.',
  'copy-failed':
    'Mhizha could not make a safety copy of your records, so it did not update them. Make sure the phone has free space, then restart.',
  'returned-to-copy':
    'Mhizha could not update your records, so it put them back as they were. Nothing was lost. Please send a problem report.',
  failed: 'Mhizha could not set up its records. Restart to try again.',
};

export function openDatabase(o: OpenOptions): OpenResult {
  const { platform } = o;
  const name = o.name ?? DATABASE_NAME;
  const steps = checkSteps(o.steps ?? appSteps);
  const latest = steps.at(-1)?.to ?? 0;
  const clock = o.clock ?? Date.now;
  const env: Env = { appVersion: o.appVersion, latest, clock, random: o.random };

  let conn = connect(platform, name);
  const before = userVersion(conn);
  const installId = before > 0 ? String(conn.get('SELECT id FROM install LIMIT 1')?.id) : uuidv7(clock(), o.random);
  const problem = (p: OpenProblem, db: Db | null): OpenResult => ({ ok: false, problem: p, message: messages[p], db });

  if (before > latest) return problem('too-new', makeDb(conn, env, installId, before));

  const pending = steps.filter((s) => s.to > before);
  if (pending.length === 0) return { ok: true, db: makeDb(conn, env, installId, before), upgraded: null };

  const copyName = `${name}.before-upgrade`;
  if (before > 0) {
    try {
      makeSafetyCopy(platform, conn, copyName, before);
    } catch (e) {
      platform.remove(copyName);
      const db = makeDb(conn, env, installId, before);
      db.logError('upgrade: safety copy', e);
      return problem('copy-failed', db);
    }
  }

  let at = before;
  for (const step of pending) {
    const startedAt = iso(clock());
    try {
      conn.exec('BEGIN IMMEDIATE');
      step.run(stepContext(conn, env, installId));
      conn.exec(`PRAGMA user_version = ${step.to}`);
      insertUpgrade(conn, env, installId, { from: at, to: step.to, startedAt, finishedAt: iso(clock()), result: 'done' });
      conn.exec('COMMIT');
      at = step.to;
    } catch (e) {
      try {
        conn.exec('ROLLBACK');
      } catch {
        // Already rolled back.
      }
      if (before === 0) {
        // A first open that failed: start again from nothing next time.
        conn.close();
        platform.remove(name);
        return problem('failed', null);
      }
      conn = returnToCopy(platform, conn, name, copyName);
      const db = makeDb(conn, env, installId, before);
      insertUpgrade(conn, env, installId, {
        from: before,
        to: step.to,
        startedAt,
        finishedAt: iso(clock()),
        result: `failed at step ${step.to}; returned to the safety copy: ${describe(e)}`,
      });
      db.logError(`upgrade: step ${step.to}`, e);
      return problem('returned-to-copy', db);
    }
  }
  platform.remove(copyName);
  return { ok: true, db: makeDb(conn, env, installId, at), upgraded: { from: before, to: at } };
}

type Env = { appVersion: string; latest: number; clock: () => number; random: RandomBytes };

function checkSteps(steps: readonly Step[]): readonly Step[] {
  steps.forEach((s, i) => {
    if (s.to !== i + 1) throw new Error(`Upgrade step ${i + 1} is numbered ${s.to}`);
  });
  return steps;
}

function connect(platform: SqlPlatform, name: string): SqlConnection {
  const conn = platform.open(name);
  conn.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;');
  return conn;
}

function userVersion(conn: SqlConnection): number {
  return Number(conn.get('PRAGMA user_version')?.user_version ?? 0);
}

function quote(path: string): string {
  return `'${path.replace(/'/g, "''")}'`;
}

function tableCounts(conn: SqlConnection): string {
  const tables = conn.all("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").map((r) => String(r.name));
  return tables.map((t) => `${t}=${conn.get(`SELECT count(*) AS n FROM "${t}"`)?.n}`).join(',');
}

/** Copies the records with VACUUM INTO, then opens the copy and checks it matches. */
function makeSafetyCopy(platform: SqlPlatform, conn: SqlConnection, copyName: string, version: number) {
  platform.remove(copyName);
  conn.exec(`VACUUM INTO ${quote(platform.pathOf(copyName))}`);
  const copy = platform.open(copyName);
  try {
    const check = String(copy.get('PRAGMA quick_check')?.quick_check);
    if (check !== 'ok') throw new Error(`safety copy check: ${check}`);
    if (userVersion(copy) !== version) throw new Error('safety copy has the wrong version');
    if (tableCounts(copy) !== tableCounts(conn)) throw new Error('safety copy record counts differ');
  } finally {
    copy.close();
  }
}

/** Puts the records back from the safety copy and opens them again. */
function returnToCopy(platform: SqlPlatform, conn: SqlConnection, name: string, copyName: string): SqlConnection {
  conn.close();
  platform.remove(name);
  const copy = platform.open(copyName);
  try {
    copy.exec(`VACUUM INTO ${quote(platform.pathOf(name))}`);
  } finally {
    copy.close();
  }
  return connect(platform, name);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function stepContext(conn: SqlConnection, env: Env, installId: string): StepContext {
  return {
    exec: (sql) => conn.exec(sql),
    run: (sql, params) => void conn.run(sql, params),
    installId,
    appVersion: env.appVersion,
    now: () => iso(env.clock()),
    newId: () => uuidv7(env.clock(), env.random),
  };
}

function insertUpgrade(conn: SqlConnection, env: Env, installId: string, e: UpgradeEntry) {
  const now = iso(env.clock());
  conn.run(
    `INSERT INTO upgrade_log (id, install_id, created_at, changed_at, from_version, to_version, started_at, finished_at, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv7(env.clock(), env.random), installId, now, now, e.from, e.to, e.startedAt, e.finishedAt, e.result],
  );
}

/** The error's name and message, quoted text removed, at most 500 characters. */
function describe(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '"…"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  if (!identifier.test(name)) throw new Error(`Not a table or column name: ${name}`);
  return name;
}

function makeDb(conn: SqlConnection, env: Env, installId: string, version: number): Db {
  let depth = 0;
  const now = () => iso(env.clock());
  const db: Db = {
    installId,
    version,
    latestVersion: env.latest,
    get: (sql, params) => conn.get(sql, params),
    all: (sql, params) => conn.all(sql, params),
    run: (sql, params) => conn.run(sql, params),
    transaction(fn) {
      const savepoint = `unit_${depth}`;
      conn.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
      depth++;
      try {
        const result = fn();
        depth--;
        conn.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
        return result;
      } catch (e) {
        depth--;
        conn.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw e;
      }
    },
    insert(table, values) {
      const id = uuidv7(env.clock(), env.random);
      const t = now();
      const cols = ['id', 'install_id', 'created_at', 'changed_at', 'change_count', ...Object.keys(values).map(ident)];
      const params = [id, installId, t, t, 0, ...Object.values(values)];
      conn.run(`INSERT INTO ${ident(table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params);
      return id;
    },
    update(table, id, values) {
      const sets = Object.keys(values).map((c) => `${ident(c)} = ?`);
      const { changes } = conn.run(
        `UPDATE ${ident(table)} SET ${[...sets, 'changed_at = ?', 'change_count = change_count + 1'].join(', ')} WHERE id = ?`,
        [...Object.values(values), now(), id],
      );
      if (changes !== 1) throw new Error(`No ${table} record ${id}`);
    },
    logError(place, error) {
      try {
        const t = now();
        conn.run(
          `INSERT INTO error_log (id, install_id, created_at, changed_at, at, app_version, db_version, place, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv7(env.clock(), env.random), installId, t, t, t, env.appVersion, version, describe(place), describe(error)],
        );
        conn.run(
          `DELETE FROM error_log WHERE rowid NOT IN (SELECT rowid FROM error_log ORDER BY rowid DESC LIMIT ${ERROR_LOG_KEEP})`,
        );
      } catch {
        // The error log must never cause an error of its own.
      }
    },
    errorLog: () =>
      conn
        .all('SELECT at, app_version, db_version, place, error FROM error_log ORDER BY rowid')
        .map((r) => ({
          at: String(r.at),
          appVersion: String(r.app_version),
          dbVersion: Number(r.db_version),
          place: String(r.place),
          error: String(r.error),
        })),
    upgradeLog: () =>
      conn
        .all('SELECT from_version, to_version, started_at, finished_at, result FROM upgrade_log ORDER BY rowid')
        .map((r) => ({
          from: Number(r.from_version),
          to: Number(r.to_version),
          startedAt: String(r.started_at),
          finishedAt: String(r.finished_at),
          result: String(r.result),
        })),
    close: () => conn.close(),
  };
  return db;
}
