// The little SQLite the database layer needs, so the same code runs on the
// phone (expo-sqlite, ./expo.ts) and in tests (Node's built-in SQLite, ./node.ts).

export type SqlValue = string | number | null | Uint8Array;
export type Row = Record<string, SqlValue>;

/** One open database file. */
export interface SqlConnection {
  exec(sql: string): void;
  run(sql: string, params?: readonly SqlValue[]): { changes: number };
  get(sql: string, params?: readonly SqlValue[]): Row | undefined;
  all(sql: string, params?: readonly SqlValue[]): Row[];
  close(): void;
}

/** Where database files live. Names are plain file names in one folder. */
export interface SqlPlatform {
  open(name: string): SqlConnection;
  /** The absolute path of a file, for `VACUUM INTO`. */
  pathOf(name: string): string;
  /** Deletes the file if it is there. The file must be closed. */
  remove(name: string): void;
}
