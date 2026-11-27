import { useReducer, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InputError } from '../../people';
import { Toggle } from '../../ui/fields';
import { List } from '../../ui/forms';
import { SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { size, space } from '../../ui/tokens';
import { usePayments } from './PaymentScreen';

/** Settings > Payment methods: hide the ones the Business never uses. */
export function PaymentMethodsScreen({ onBack }: { onBack: () => void }) {
  const c = useColours();
  const pay = usePayments();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (code: Parameters<typeof pay.setHidden>[0], shown: boolean) => {
    try {
      pay.setHidden(code, !shown);
      setProblem(null);
      refresh();
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setProblem(e.message);
      AccessibilityInfo.announceForAccessibility(e.message);
    }
  };
  return (
    <>
      <SubTopBar title="Payment methods" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.main}>
        <Text style={[parts.body, { color: c.label }]}>
          Switch off the ways you are never paid, so Record Payment shows only the others. Old Receipts keep theirs.
        </Text>
        <List>
          {pay.methods().map((m, i) => (
            <View key={m.code} style={[styles.row, i > 0 && { borderTopWidth: size.hairline, borderTopColor: c.line }]}>
              <Toggle
                label={m.name}
                hint={m.code === 'other' ? 'You say how they paid each time' : undefined}
                value={!m.hidden}
                onChange={(on) => set(m.code, on)}
              />
            </View>
          ))}
        </List>
        {problem ? (
          <Text accessibilityLiveRegion="polite" style={[parts.small, styles.problem, { color: c.bad }]}>
            {`! ${problem}`}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  main: { padding: space.s4, gap: space.s4 },
  row: { paddingHorizontal: space.s3 },
  problem: { fontWeight: '700' },
});
