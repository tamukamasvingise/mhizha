import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { PdfPart } from '../../documents/screens/DocumentScreen';
import type { Nav } from '../../people/screens/common';
import { longDate, longDateTime } from '../../setup/dates';
import { List, Row, Section } from '../../ui/forms';
import { SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import { appliedNotice, appliedTitle } from '..';
import { usePayments } from './PaymentScreen';

// One Receipt: who paid, how much, how and when, its PDF, and what it paid
// with the balance left on each Invoice when it was issued. A "Deposit
// applied" Receipt says no new money was received and names the Receipt the
// Deposit was paid on.

export function ReceiptScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const pay = usePayments();
  const r = pay.receipt(id);
  const facts: [string, string][] = [['Issued', longDateTime(r.issuedAt)]];
  const applied = r.kind === 'deposit-applied';
  if (r.dateReceived !== r.issueDate) facts.push(['Date received', longDate(r.dateReceived)]);
  if (!applied) facts.push(['How they paid', r.method]);

  return (
    <View style={styles.screen}>
      <SubTopBar title={r.number} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.head}>
          <Text style={[parts.small, { color: c.label }]}>{applied ? `Receipt · ${appliedTitle(r)}` : 'Receipt'}</Text>
          <Text accessibilityRole="header" style={[styles.number, { color: c.fg }]}>
            {r.number}
          </Text>
          <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`${applied ? 'Applied' : 'Received'} · ${formatUsd(r.amount)}`}</Text>
          <Text style={[parts.body, { color: c.label }]}>{r.customerName}</Text>
        </View>
        {applied ? <Text style={[parts.body, { color: c.fg }]}>{appliedNotice(r)}</Text> : null}

        <PdfPart id={id} number={r.number} />

        <List>
          {facts.map(([k, v], i) => (
            <Row key={k} first={i === 0} title={v} subtitle={k} label={`${k}: ${v}`} />
          ))}
        </List>

        <Section title={applied ? 'What it was applied to' : 'What it paid'}>
          <List>
            {r.lines.map((l, i) => (
              <Row
                key={`${l.appliedTo}-${i}`}
                first={i === 0}
                title={`${l.appliedTo} · ${l.jobTitle}`}
                subtitle={l.balanceLeft > 0 ? `Left to pay then: ${formatUsd(l.balanceLeft)}` : '✓ Paid in full'}
                right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(l.amount)}</Text>}
                onPress={l.invoiceId ? () => nav.open({ screen: 'document', id: l.invoiceId! }) : undefined}
              />
            ))}
          </List>
        </Section>
        <Text style={[parts.small, { color: c.label }]}>{r.sumInWords}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8, gap: space.s4 },
  head: { gap: space.s1 },
  number: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  strong: { fontWeight: '600' },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
});
