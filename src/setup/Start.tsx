import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDb } from '../shell/Records';
import { Mark } from '../ui/Icon';
import { Button, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, space, type } from '../ui/tokens';
import { today } from './forms';
import { unlockWithPhone } from './lock';
import { SetupWizard } from './SetupWizard';
import { appLock, setupStatus, startNew } from './store';

// What the app opens on: the first screen of a new install, the setup wizard
// until it is finished, then the app itself, behind the App lock if chosen.

/** Away from the app for longer than this, and the App lock asks again. */
const RELOCK_AFTER_MS = 60_000;

export function Start({ children }: { children: ReactNode }) {
  const db = useDb();
  const [status, setStatus] = useState(() => setupStatus(db));
  if (status === 'new')
    return (
      <FirstOpen
        onStartNew={() => {
          startNew(db, today());
          setStatus('started');
        }}
      />
    );
  if (status === 'started') return <SetupWizard onDone={() => setStatus('done')} />;
  return <LockGate>{children}</LockGate>;
}

/** A focused screen: the mark and name, a title, a line of words, then actions. */
function Focused({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const c = useColours();
  const insets = useSafeAreaInsets();
  return (
    <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={local.main}>
        <View style={local.mark} accessible accessibilityLabel="Mhizha">
          <Mark colour={c.brand} />
          <Text style={[local.markText, { color: c.fg }]}>Mhizha</Text>
        </View>
        <Text accessibilityRole="header" style={[local.title, { color: c.fg }]}>
          {title}
        </Text>
        <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.label }]}>
          {body}
        </Text>
        {children}
      </ScrollView>
    </View>
  );
}

function FirstOpen({ onStartNew }: { onStartNew: () => void }) {
  const c = useColours();
  const [restoreNote, setRestoreNote] = useState(false);
  return (
    <Focused
      title="Quotations, Invoices and Receipts for your business"
      body="Start new if this is your first time with Mhizha. If you used Mhizha on another phone, restore your backup instead."
    >
      <View style={local.actions}>
        <Button primary label="Start new" onPress={onStartNew} />
        <Button label="Restore from a backup" onPress={() => setRestoreNote(true)} />
      </View>
      <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.label }]}>
        {restoreNote ? 'Restoring a backup comes in a later test build. Tap Start new for now.' : ''}
      </Text>
    </Focused>
  );
}

function LockGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const [locked, setLocked] = useState(() => appLock(db));
  const [failed, setFailed] = useState(false);
  const leftAt = useRef<number | null>(null);
  const asking = useRef(false);

  async function unlock() {
    if (asking.current) return;
    asking.current = true;
    const ok = await unlockWithPhone();
    asking.current = false;
    setFailed(!ok);
    if (ok) setLocked(false);
  }

  useEffect(() => {
    if (locked) unlock();
    // Ask once on open; the button asks again.
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state !== 'active' || leftAt.current === null) return;
      const away = Date.now() - leftAt.current;
      leftAt.current = null;
      if (!asking.current && appLock(db) && away > RELOCK_AFTER_MS) {
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  });

  if (!locked) return <>{children}</>;
  return (
    <Focused
      title="Mhizha is locked"
      body={failed ? "Your phone's lock was not confirmed. Tap Unlock to try again." : "Unlock with your phone's screen lock."}
    >
      <View style={local.actions}>
        <Button primary label="Unlock" onPress={unlock} />
      </View>
    </Focused>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, paddingTop: space.s8, gap: space.s4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  markText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  title: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  actions: { gap: space.s2 },
});
