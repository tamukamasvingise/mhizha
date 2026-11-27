import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { OpenResult } from './db';
import { openAppDatabase } from './db/appDatabase';
import { ProblemBoundary, UnexpectedProblem } from './shell/Problem';
import { Records } from './shell/Records';
import { SelfTest } from './shell/SelfTest';
import { Shell } from './shell/Shell';

// Test builds answer these links from the emulator job.
const selfTestLinks = Constants.expoConfig?.extra?.selfTest === true;
const DB_CHECKS = 'mhizha-test://self-test/db';
const SHOW_ERROR = 'mhizha-test://self-test/error';

function open(): OpenResult {
  try {
    return openAppDatabase();
  } catch {
    return { ok: false, problem: 'failed', message: 'Mhizha could not open its records. Restart to try again.', db: null };
  }
}

// Errors outside drawing (a button's action, a late promise) reach this
// handler; it logs them and switches to the problem screen instead of crashing.
let showProblem: (() => void) | null = null;
let opened: OpenResult | null = null;
const logError = (place: string, error: unknown) => opened?.db?.logError(place, error);
ErrorUtils.setGlobalHandler((error) => {
  logError('app', error);
  showProblem?.();
});

function Thrower(): ReactNode {
  throw new Error('Problem screen check from the emulator job');
}

export default function App() {
  const [records] = useState(() => (opened = open()));
  const [failed, setFailed] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    showProblem = () => setFailed(true);
    if (!selfTestLinks) return;
    Linking.getInitialURL().then((u) => setLink(u ?? null), () => undefined);
    const sub = Linking.addEventListener('url', (e) => setLink(e.url));
    return () => sub.remove();
  }, []);

  let screen: ReactNode;
  if (failed) screen = <UnexpectedProblem />;
  else if (link === DB_CHECKS) screen = <SelfTest />;
  else
    screen = (
      <Records opened={records}>
        {link === SHOW_ERROR ? <Thrower /> : <Shell />}
      </Records>
    );

  return (
    <SafeAreaProvider>
      <ProblemBoundary onError={(e) => logError('screen', e)}>{screen}</ProblemBoundary>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
