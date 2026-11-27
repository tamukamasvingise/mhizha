import { reloadAppAsync } from 'expo';
import { Component, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mark } from '../ui/Icon';
import { Button, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, space, type } from '../ui/tokens';

// The plain screen shown when something goes wrong: an unexpected error, or
// records that could not be opened or updated. Focused shell: the mark, no tabs.

/** The screen for an unexpected error. */
export function UnexpectedProblem() {
  return (
    <ProblemScreen
      title="Something went wrong. Your records are safe."
      body="Restart Mhizha to carry on. If this keeps happening, send a problem report."
    />
  );
}

async function restart() {
  try {
    await reloadAppAsync('Restart from the problem screen');
  } catch {
    // Reloading is not possible here: the screen stays, and the User can close the app.
  }
}

export function ProblemScreen({ title, body }: { title: string; body: string }) {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [reportNote, setReportNote] = useState(false);
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
        <Text style={[parts.body, { color: c.label }]}>{body}</Text>
        <View style={local.actions}>
          <Button primary label="Restart" onPress={restart} />
          <Button label="Send a problem report" onPress={() => setReportNote(true)} />
        </View>
        <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.label }]}>
          {reportNote ? 'Problem reports come in a later test build. Restart Mhizha to carry on.' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

type BoundaryProps = { children: ReactNode; onError: (error: unknown) => void };

/** Catches errors while drawing a screen and shows the problem screen instead. */
export class ProblemBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (this.state.failed) {
      return <UnexpectedProblem />;
    }
    return this.props.children;
  }
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, paddingTop: space.s8, gap: space.s4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  markText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  title: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  actions: { gap: space.s3 },
});
