import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Db, OpenProblem, OpenResult } from '../db';
import { checkOnOpen } from '../health/checks';
import { ProblemScreen } from './Problem';

// Hands the open records to every screen, and runs the checks on open once.
// If the records could not be opened or updated, the problem screen says so in
// plain words instead.

const RecordsContext = createContext<Db | null>(null);
const CheckContext = createContext(false);

/** The open records. Only screens inside `Records` may call it. */
export function useDb(): Db {
  const db = useContext(RecordsContext);
  if (!db) throw new Error('useDb outside Records');
  return db;
}

/** Whether a check on open failed this time. */
export function useCheckFailed(): boolean {
  return useContext(CheckContext);
}

const titles: Record<OpenProblem, string> = {
  'too-new': 'Update Mhizha first',
  'copy-failed': 'Mhizha could not update',
  'returned-to-copy': 'Mhizha could not update',
  failed: 'Mhizha could not start',
};

type Props = {
  opened: OpenResult;
  children: ReactNode;
  /** Test builds only: show the failed-check banner without breaking records. */
  failCheckForTest?: boolean;
};

export function Records({ opened, children, failCheckForTest }: Props) {
  if (!opened.ok) return <ProblemScreen title={titles[opened.problem]} body={opened.message} db={opened.db} />;
  return (
    <OpenRecords db={opened.db} failCheckForTest={failCheckForTest}>
      {children}
    </OpenRecords>
  );
}

function OpenRecords({ db, children, failCheckForTest }: { db: Db; children: ReactNode; failCheckForTest?: boolean }) {
  const [failed] = useState(() => checkOnOpen(db).failed);
  return (
    <RecordsContext.Provider value={db}>
      <CheckContext.Provider value={failed || failCheckForTest === true}>{children}</CheckContext.Provider>
    </RecordsContext.Provider>
  );
}
