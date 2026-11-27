// The database checks. Plain functions over a SqlPlatform, so the same checks
// run under Vitest on Node's SQLite (database.test.ts) and inside the `.test`
// app on the real expo-sqlite in the emulator job (selfTest.ts).
import { openDatabase, type Db, type OpenOptions } from './database';
import { recordColumns, steps as appSteps, type Step } from './steps';
import type { SqlPlatform } from './sql';

export type DbCheck = { name: string; run: (platform: SqlPlatform) => void };

class CheckFailed extends Error {}

function same<T>(actual: T, expected: T, what: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new CheckFailed(`${what}: expected ${e}, got ${a}`);
}

function yes(value: boolean, what: string) {
  if (!value) throw new CheckFailed(what);
}

let seed = 0;
const fixed = (platform: SqlPlatform, more: Partial<OpenOptions> = {}): OpenOptions => ({
  platform,
  appVersion: '1.0.0',
  clock: () => Date.UTC(2026, 10, 27, 12, 0, 0),
  random: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 31 + 7) % 256)),
  ...more,
});

export const dbChecks: DbCheck[] = [
  {
    name: 'a first open makes the records at the latest version with an install ID',
    run(platform) {
      const opened = openDatabase(fixed(platform));
      yes(opened.ok, 'opens');
      if (!opened.ok) return;
      const { db } = opened;
      same(db.version, db.latestVersion, 'version');
      yes(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(db.installId), 'install ID is a UUID v7');
      db.close();
      const again = openDatabase(fixed(platform));
      yes(again.ok && again.db.installId === db.installId, 'the install ID stays the same on the next open');
      if (again.ok) again.db.close();
    },
  },
];

// Test steps on top of the app's first step: 2 adds a note table, 3 adds a
// column, `broken` changes something and then fails.
const base = appSteps[0]!;
const addNotes: Step = {
  to: 2,
  name: 'notes',
  run: (ctx) => ctx.exec(`CREATE TABLE note (${recordColumns()}, text TEXT NOT NULL) STRICT;`),
};
const addColour: Step = { to: 3, name: 'colour', run: (ctx) => ctx.exec('ALTER TABLE note ADD COLUMN colour TEXT;') };
const broken = (to: number): Step => ({
  to,
  name: 'broken',
  run(ctx) {
    ctx.exec('CREATE TABLE half_done (x INTEGER) STRICT;');
    throw new Error("step broke on 'Mr Secret Customer'");
  },
});

function open(platform: SqlPlatform, steps: readonly Step[]) {
  const opened = openDatabase(fixed(platform, { steps }));
  if (!opened.ok) throw new CheckFailed(`open failed: ${opened.problem}`);
  return opened;
}

const tables = (db: Db) => db.all("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").map((r) => r.name);

dbChecks.push(
  {
    name: 'an older database is upgraded step by step and keeps its records',
    run(platform) {
      const v1 = open(platform, [base]).db;
      const installId = v1.installId;
      v1.close();
      const v2 = open(platform, [base, addNotes]).db;
      const id = v2.insert('note', { text: 'kept' });
      v2.close();
      const v3 = open(platform, [base, addNotes, addColour]);
      same(v3.upgraded, { from: 2, to: 3 }, 'upgraded');
      same(v3.db.version, 3, 'version');
      same(v3.db.installId, installId, 'install ID');
      same(v3.db.get('SELECT text, colour FROM note WHERE id = ?', [id]), { text: 'kept', colour: null }, 'record');
      same(
        v3.db.upgradeLog().map((e) => [e.from, e.to, e.result]),
        [[0, 1, 'done'], [1, 2, 'done'], [2, 3, 'done']],
        'upgrade log',
      );
      v3.db.close();
    },
  },
  {
    name: 'a failing step returns to the safety copy, undoing earlier steps of the same upgrade, and says so',
    run(platform) {
      const v1 = open(platform, [base]).db;
      v1.close();
      const v2 = open(platform, [base, addNotes]).db;
      const id = v2.insert('note', { text: 'kept' });
      v2.close();
      const opened = openDatabase(fixed(platform, { steps: [base, addNotes, addColour, broken(4)] }));
      yes(!opened.ok && opened.problem === 'returned-to-copy', 'returns to the copy');
      if (opened.ok || !opened.db) return;
      const { db } = opened;
      yes(opened.message.includes('put them back as they were'), 'says so in plain words');
      same(db.version, 2, 'version is the one before the upgrade');
      same(db.get('PRAGMA user_version'), { user_version: 2 }, 'file version');
      same(tables(db).includes('half_done'), false, 'the broken step left nothing');
      yes(!(db.all('PRAGMA table_info(note)').some((c) => c.name === 'colour')), 'step 3, which worked, was undone too');
      same(db.get('SELECT text FROM note WHERE id = ?', [id]), { text: 'kept' }, 'record');
      const last = db.upgradeLog().at(-1)!;
      same([last.from, last.to], [2, 4], 'upgrade log names the upgrade');
      yes(last.result.startsWith('failed at step 4; returned to the safety copy'), `upgrade log result: ${last.result}`);
      const err = db.errorLog().at(-1)!;
      same(err.place, 'upgrade: step 4', 'error log place');
      yes(!err.error.includes('Secret'), 'error log leaves out quoted record contents');
      db.close();
      const again = open(platform, [base, addNotes]);
      same(again.upgraded, null, 'the records open as before with the old steps');
      again.db.close();
    },
  },
  {
    name: 'records from a newer Mhizha are refused, not touched',
    run(platform) {
      open(platform, [base, addNotes]).db.close();
      const opened = openDatabase(fixed(platform, { steps: [base] }));
      yes(!opened.ok && opened.problem === 'too-new', 'refused');
      opened.db?.close();
      const again = open(platform, [base, addNotes]);
      same(again.db.version, 2, 'still version 2');
      again.db.close();
    },
  },
  {
    name: 'a failed first open leaves nothing behind, so the next open starts clean',
    run(platform) {
      const opened = openDatabase(fixed(platform, { steps: [base, broken(2)] }));
      yes(!opened.ok && opened.problem === 'failed', 'fails');
      const again = open(platform, [base, addNotes]);
      same(again.upgraded, { from: 0, to: 2 }, 'starts from nothing');
      again.db.close();
    },
  },
  {
    name: 'no upgrade happens if the safety copy cannot be made',
    run(platform) {
      open(platform, [base]).db.close();
      const noCopies: SqlPlatform = {
        ...platform,
        pathOf: (n) => (n.endsWith('.before-upgrade') ? `${platform.pathOf('missing-folder')}/x/${n}` : platform.pathOf(n)),
      };
      const opened = openDatabase(fixed(noCopies, { steps: [base, addNotes] }));
      yes(!opened.ok && opened.problem === 'copy-failed', 'refuses to upgrade');
      if (opened.ok || !opened.db) return;
      same(opened.db.version, 1, 'still version 1');
      same(tables(opened.db).includes('note'), false, 'no step ran');
      same(opened.db.errorLog().at(-1)?.place, 'upgrade: safety copy', 'logged');
      opened.db.close();
    },
  },
);
