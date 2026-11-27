import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runDbSelfTest, type SelfTestResult } from '../db/selfTest';
import { styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { space } from '../ui/tokens';

// Test builds only, opened by the emulator job through a link: runs the
// database checks on the real expo-sqlite and shows the result.

export function SelfTest() {
  const c = useColours();
  const insets = useSafeAreaInsets();
  const [result] = useState<SelfTestResult>(() => {
    const r = runDbSelfTest();
    console.log('MHIZHA_DB_CHECKS ' + JSON.stringify(r));
    return r;
  });
  return (
    <View style={[local.root, { backgroundColor: c.page, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={local.main}>
        <Text accessibilityRole="header" style={[parts.emptyTitle, { color: c.fg, textAlign: 'left' }]}>
          {`Database checks: ${result.passed} passed, ${result.failed.length} failed`}
        </Text>
        {result.failed.map((f) => (
          <Text key={f.name} style={[parts.body, { color: c.bad }]}>
            {`! ${f.name}: ${f.error}`}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  root: { flex: 1 },
  main: { padding: space.s4, gap: space.s3 },
});
