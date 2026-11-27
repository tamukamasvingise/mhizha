// The database layer. Screens and features use `Db`; upgrade steps live in steps.ts.
export { openDatabase, messages, DATABASE_NAME, ERROR_LOG_KEEP } from './database';
export type { Db, OpenOptions, OpenResult, OpenProblem, ErrorEntry, UpgradeEntry } from './database';
export { recordColumns, steps } from './steps';
export type { Step, StepContext } from './steps';
export type { SqlPlatform, SqlConnection, SqlValue, Row } from './sql';
export { uuidv7 } from './uuid';
