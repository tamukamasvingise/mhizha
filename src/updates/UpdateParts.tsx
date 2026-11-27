import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, Text, View } from 'react-native';
import { longDate, todayAt } from '../setup/dates';
import { useDb } from '../shell/Records';
import { Toggle } from '../ui/fields';
import { List, Row, Section } from '../ui/forms';
import { Button } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, radius, size, space, type } from '../ui/tokens';
import { shortVersion, SITE_URL } from './site';
import { autoCheck, autoCheckOn, checkNow, dismissUpdate, lastChecked, setAutoCheck, updateBanner, type CheckOptions, type Fetch } from './updates';

// The update check on screen: the Home banner, which also runs the automatic
// check once when the app opens, and the Updates section in Settings.

const current = Constants.expoConfig?.version ?? '0.0.0';
const TIMEOUT_MS = 15000;

/** Asks for the address alone, giving up after 15 s. */
const fetchFile: Fetch = (url) => {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  return fetch(url, { signal: stop.signal, cache: 'no-store' }).finally(() => clearTimeout(timer));
};

const options = (): CheckOptions => ({ fetch: fetchFile, today: todayAt(Date.now()), current });

/** The banner text for a newer version. */
export const readyText = (version: string) => `Mhizha ${shortVersion(version)} is ready. Make a Backup, then download.`;

/** Opens the site, which shows the install steps before the download. */
const download = () => Linking.openURL(SITE_URL).catch(() => undefined);

let checkedThisOpen = false;

/** On Home while a newer version waits, until the User updates or dismisses it. */
export function UpdateBanner() {
  const c = useColours();
  const db = useDb();
  const [version, setVersion] = useState(() => updateBanner(db, current));

  useEffect(() => {
    if (checkedThisOpen) return;
    checkedThisOpen = true;
    let live = true;
    autoCheck(db, options())
      .then(() => live && setVersion(updateBanner(db, current)))
      .catch((e: unknown) => db.logError('update check', e));
    return () => {
      live = false;
    };
  }, [db]);

  if (!version) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[local.banner, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[local.title, { color: c.fg }]}>{readyText(version)}</Text>
      <View style={local.actions}>
        <Button primary label="Download" onPress={download} />
        <Button
          label="Dismiss"
          onPress={() => {
            dismissUpdate(db, version);
            setVersion(null);
          }}
        />
      </View>
    </View>
  );
}

type Status = { kind: 'idle' } | { kind: 'checking' } | Awaited<ReturnType<typeof checkNow>>;

/** Settings: Check for updates, its result, and the daily check switch. */
export function UpdateSettings() {
  const c = useColours();
  const db = useDb();
  const [auto, setAuto] = useState(() => autoCheckOn(db));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [last, setLast] = useState(() => lastChecked(db));

  useEffect(() => {
    if (status.kind !== 'idle') AccessibilityInfo.announceForAccessibility(sub);
  }, [status]);

  const check = () => {
    if (status.kind === 'checking') return;
    setStatus({ kind: 'checking' });
    checkNow(db, options())
      .then((r) => {
        setStatus(r);
        setLast(lastChecked(db));
      })
      .catch((e: unknown) => {
        db.logError('update check', e);
        setStatus({ kind: 'failed' });
      });
  };

  const sub =
    status.kind === 'checking'
      ? 'Checking…'
      : status.kind === 'up-to-date'
        ? `✓ Mhizha ${shortVersion(current)} is the latest version.`
        : status.kind === 'newer'
          ? readyText(status.version)
          : status.kind === 'failed'
            ? '! Could not reach the Mhizha site. Check your internet and try again.'
            : last
              ? `Last checked ${longDate(last)}`
              : 'Not checked yet';

  return (
    <Section title="Updates">
      <List>
        <Row first title="Check for updates" subtitle={sub} onPress={check} />
        {status.kind === 'newer' ? (
          <View style={[local.inRow, { borderTopColor: c.line }]}>
            <Button primary label="Download" onPress={download} />
          </View>
        ) : null}
        <View style={[local.inRow, { borderTopColor: c.line }]}>
          <Toggle
            label="Check once a day"
            hint="When Mhizha opens with internet. Nothing about you or your records is sent."
            value={auto}
            onChange={(on) => {
              setAutoCheck(db, on);
              setAuto(on);
            }}
          />
        </View>
      </List>
    </Section>
  );
}

const local = StyleSheet.create({
  banner: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s3 },
  title: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  inRow: { borderTopWidth: size.hairline, paddingHorizontal: space.s3, paddingVertical: space.s2 },
});
