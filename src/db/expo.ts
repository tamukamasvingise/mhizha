// SqlPlatform on expo-sqlite: the app's real database files.
import * as SQLite from 'expo-sqlite';
import type { Row, SqlConnection, SqlPlatform, SqlValue } from './sql';

/** `prefix` keeps the emulator self-test's files apart from the real records. */
export function expoPlatform(prefix = ''): SqlPlatform {
  const dir = String(SQLite.defaultDatabaseDirectory).replace(/^file:\/\//, '').replace(/\/$/, '');
  return {
    open(name) {
      return connect(SQLite.openDatabaseSync(prefix + name));
    },
    pathOf: (name) => `${dir}/${prefix}${name}`,
    remove(name) {
      try {
        SQLite.deleteDatabaseSync(prefix + name);
      } catch {
        // Not there: nothing to delete.
      }
    },
  };
}

function connect(db: SQLite.SQLiteDatabase): SqlConnection {
  const p = (params?: readonly SqlValue[]) => (params ?? []) as SqlValue[];
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params) => ({ changes: db.runSync(sql, p(params)).changes }),
    get: (sql, params) => db.getFirstSync<Row>(sql, p(params)) ?? undefined,
    all: (sql, params) => db.getAllSync<Row>(sql, p(params)),
    close: () => db.closeSync(),
  };
}
