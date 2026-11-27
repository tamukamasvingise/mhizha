// SqlPlatform on Node's built-in SQLite, for tests. Never imported by the app.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Row, SqlConnection, SqlPlatform, SqlValue } from './sql';

/** A platform over a new empty temporary folder. */
export function nodePlatform(dir = mkdtempSync(join(tmpdir(), 'mhizha-db-'))): SqlPlatform {
  return {
    open(name) {
      return connect(new DatabaseSync(join(dir, name)));
    },
    pathOf: (name) => join(dir, name),
    remove(name) {
      for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(join(dir, name + suffix), { force: true });
    },
  };
}

function connect(db: DatabaseSync): SqlConnection {
  const p = (params?: readonly SqlValue[]) => (params ?? []) as SqlValue[];
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => ({ changes: Number(db.prepare(sql).run(...p(params)).changes) }),
    get: (sql, params) => db.prepare(sql).get(...p(params)) as Row | undefined,
    all: (sql, params) => db.prepare(sql).all(...p(params)) as Row[],
    close: () => db.close(),
  };
}
