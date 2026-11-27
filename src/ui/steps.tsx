import { StyleSheet, Text, View } from 'react-native';
import { Button, styles as parts } from './parts';
import { useColours } from './theme';
import { lineHeight, radius, size, space, type } from './tokens';

// The parts of a step-by-step flow, one question per screen: the setup wizard
// and making a Document. Screens use these, never their own copies.

/** The step bar, "Step n of N", the step's one question and a `label` line under it. */
export function StepHead({ n, of, question, lead }: { n: number; of: number; question: string; lead?: string }) {
  const c = useColours();
  return (
    <>
      <View style={styles.bar} accessible accessibilityLabel={`Step ${n} of ${of}`}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < n ? c.brand : c.line }]} />
        ))}
      </View>
      <Text style={[parts.small, { color: c.label }]} importantForAccessibility="no">
        {`Step ${n} of ${of}`}
      </Text>
      <Text accessibilityRole="header" style={[styles.question, { color: c.fg }]}>
        {question}
      </Text>
      {lead ? <Text style={[parts.body, { color: c.label }]}>{lead}</Text> : null}
    </>
  );
}

/** The foot of a step: Back, then the main action (primary). Either may be left out. */
export function StepFoot({
  onBack,
  next,
}: {
  onBack?: () => void;
  next?: { label: string; onPress: () => void };
}) {
  const c = useColours();
  if (!onBack && !next) return null;
  return (
    <View style={[styles.foot, { backgroundColor: c.surface, borderTopColor: c.line }]}>
      {onBack ? (
        <View style={styles.grow}>
          <Button label="Back" onPress={onBack} />
        </View>
      ) : null}
      {next ? (
        <View style={styles.grow}>
          <Button primary label={next.label} onPress={next.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space.s1 },
  segment: { flex: 1, height: size.stepBar, borderRadius: radius.r },
  question: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  foot: { flexDirection: 'row', gap: space.s2, padding: space.s4, borderTopWidth: size.hairline },
  grow: { flex: 1 },
});
