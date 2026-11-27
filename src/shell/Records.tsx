import { createContext, useContext, type ReactNode } from 'react';
import type { Db, OpenProblem, OpenResult } from '../db';
import { ProblemScreen } from './Problem';

// Hands the open records to every screen. If they could not be opened or
// updated, the problem screen says so in plain words instead.

const RecordsContext = createContext<Db | null>(null);

/** The open records. Only screens inside `Records` may call it. */
export function useDb(): Db {
  const db = useContext(RecordsContext);
  if (!db) throw new Error('useDb outside Records');
  return db;
}

const titles: Record<OpenProblem, string> = {
  'too-new': 'Update Mhizha first',
  'copy-failed': 'Mhizha could not update',
  'returned-to-copy': 'Mhizha could not update',
  failed: 'Mhizha could not start',
};

export function Records({ opened, children }: { opened: OpenResult; children: ReactNode }) {
  if (!opened.ok) return <ProblemScreen title={titles[opened.problem]} body={opened.message} />;
  return <RecordsContext.Provider value={opened.db}>{children}</RecordsContext.Provider>;
}
