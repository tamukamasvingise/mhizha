import { useMemo, useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, View } from 'react-native';
import { today } from '../../dates';
import { useDb } from '../../shell/Records';
import type { Sub } from '../../shell/navigation';
import { TextField } from '../../ui/parts';
import { space } from '../../ui/tokens';
import { InputError, people, type Address, type People } from '..';

// What the Customer, Site and Job screens share.

/** How a sub screen moves: open another on top, swap itself for another, or go back. */
export type Nav = { open(sub: Sub): void; replace(sub: Sub): void; back(): void };

/** Customers, Sites and Jobs over the open records, with today on the phone. */
export function usePeople(): People {
  const db = useDb();
  return useMemo(() => people(db, today), [db]);
}

/**
 * A form's problems. `attempt` runs a save; if the User must fix something it
 * keeps the problems for the fields, says so to screen readers and returns false.
 */
export function useProblems() {
  const [problems, setProblems] = useState<Record<string, string>>({});
  const attempt = (save: () => void): boolean => {
    try {
      save();
      setProblems({});
      return true;
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setProblems(e.problems);
      AccessibilityInfo.announceForAccessibility(`Not saved. ${e.message}`);
      return false;
    }
  };
  return { problems, attempt, clear: () => setProblems({}) };
}

/** Opens a `tel:` or WhatsApp link; says so if the phone cannot. */
export async function openLink(url: string | null, failed: (message: string) => void, what: string) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    failed(`This phone could not open ${what}.`);
  }
}

/** The parts of a structured address, one field each. */
export function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <View style={styles.group}>
      <TextField label="Street address (optional)" hint="House or stand number and street" value={value.lines} onChange={set('lines')} />
      <TextField label="Suburb (optional)" value={value.suburb} onChange={set('suburb')} />
      <TextField label="Town or city (optional)" value={value.city} onChange={set('city')} />
      <TextField label="Province (optional)" value={value.province} onChange={set('province')} />
      <TextField label="Country (optional)" value={value.country} onChange={set('country')} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8, gap: space.s4 },
  group: { gap: space.s3 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
});
