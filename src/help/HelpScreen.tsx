import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { List, Row, Section } from '../ui/forms';
import { SubTopBar, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { lineHeight, size, space, type } from '../ui/tokens';
import { help } from './help';

// Help in Settings: the tutorials and how to get help, built in so they work
// with no internet.

export function HelpScreen({ onBack, onReport }: { onBack: () => void; onReport: () => void }) {
  const c = useColours();
  return (
    <>
      <SubTopBar title="Help" onBack={onBack} />
      <ScrollView contentContainerStyle={local.page}>
        <Text style={[parts.body, { color: c.label }]}>Step by step guides. They work without internet.</Text>
        {help.map((topic) => (
          <Section key={topic.id} title={topic.title}>
            <List>
              {topic.steps.map((step, i) => (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${i + 1}. ${step}`}
                  style={[local.step, i > 0 && { borderTopWidth: size.hairline, borderTopColor: c.line }]}
                >
                  <Text style={[local.number, { color: c.label }]}>{i + 1}</Text>
                  <Text style={[parts.body, local.text, { color: c.fg }]}>{step}</Text>
                </View>
              ))}
              {topic.id === 'support' ? (
                <Row title="Send a problem report" subtitle="See it before you share it" onPress={onReport} />
              ) : null}
            </List>
          </Section>
        ))}
      </ScrollView>
    </>
  );
}

const local = StyleSheet.create({
  page: { padding: space.s4, gap: space.s4 },
  step: { flexDirection: 'row', gap: space.s3, padding: space.s3 },
  number: { minWidth: space.s4, fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
});
