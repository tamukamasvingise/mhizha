import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { discountLabel, formatQuantity, formatUsd } from '../../core';
import { customerOwes } from '../../ledger';
import { appliedTo } from '../../payments';
import { ReceiptScreen } from '../../payments/screens/ReceiptScreen';
import { addressLine } from '../../people';
import { invoicePdf, shareInvoicePdf } from '../../pdf/files';
import type { Nav } from '../../people/screens/common';
import { useDb } from '../../shell/Records';
import { longDate, longDateTime } from '../../setup/dates';
import { List, Row, Section } from '../../ui/forms';
import { Button, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, size, space, type } from '../../ui/tokens';
import { STATUS_WORDS, useDocuments } from './common';

// One Issued Invoice: its number and status, what it printed (from its frozen
// copy), its lines and totals, what has been paid, what the Customer owes now,
// and Record Payment while money is owing. A Receipt has its own screen.

export function DocumentScreen({ id, nav }: { id: string; nav: Nav }) {
  const d = useDocuments();
  return d.issued(id).type === 'REC' ? <ReceiptScreen id={id} nav={nav} /> : <InvoiceScreen id={id} nav={nav} />;
}

function InvoiceScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const db = useDb();
  const d = useDocuments();
  const inv = d.issued(id);
  const f = inv.frozen;
  const owes = customerOwes(db, inv.customerId);
  const paid = appliedTo(db, id);
  const left = inv.total - paid;
  const facts: [string, string][] = [
    ['Issued', longDateTime(inv.issuedAt)],
    ['Due', longDate(inv.dueDate)],
  ];
  if (inv.orderNo) facts.push(['Order No.', inv.orderNo]);
  facts.push(['Site', [f.site.name, addressLine(f.site.address)].filter(Boolean).join(' · ')]);

  return (
    <View style={styles.screen}>
      <SubTopBar title={inv.number} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.head}>
          <Text style={[parts.small, { color: c.label }]}>Invoice</Text>
          <Text accessibilityRole="header" style={[styles.number, { color: c.fg }]}>
            {inv.number}
          </Text>
          <Text
            style={[
              parts.body,
              styles.strong,
              { color: inv.status === 'overdue' ? c.bad : c.fg },
            ]}
          >
            {`${STATUS_WORDS[inv.status]} · ${formatUsd(inv.total)}`}
          </Text>
          <Text style={[parts.body, { color: c.label }]}>{`${f.customer.name} · ${f.job.title}`}</Text>
        </View>

        {left > 0 ? (
          <Button primary label="Record Payment" onPress={() => nav.open({ screen: 'payment', customerId: inv.customerId })} />
        ) : null}
        <PdfPart id={id} number={inv.number} />

        <List>
          {facts.map(([k, v], i) => (
            <Row key={k} first={i === 0} title={v} subtitle={k} label={`${k}: ${v}`} />
          ))}
        </List>

        <Section title="Lines">
          <List>
            {inv.lines.map((l, i) => (
              <Row
                key={l.id}
                first={i === 0}
                title={l.description}
                subtitle={`${formatQuantity(l.quantity)}${l.unit ? ` ${l.unit}` : ''} × ${formatUsd(l.unitPrice)}`}
                right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(l.amount)}</Text>}
              />
            ))}
          </List>
        </Section>

        <View style={styles.totals}>
          <Line k="Subtotal" v={formatUsd(inv.subtotal)} />
          {inv.discount > 0 && inv.discountKind ? <Line k={discountLabel(inv.discountKind)} v={`−${formatUsd(inv.discount)}`} /> : null}
          <View style={[styles.totalRow, styles.totalLine, { borderTopColor: c.line }]}>
            <Text style={[styles.totalText, styles.grow, { color: c.fg }]}>Total</Text>
            <Text style={[styles.totalText, styles.amount, { color: c.fg }]}>{formatUsd(inv.total)}</Text>
          </View>
          <Text style={[parts.small, { color: c.label }]}>{inv.sumInWords}</Text>
          {paid > 0 ? (
            <>
              <Line k="Paid" v={`−${formatUsd(paid)}`} />
              <View style={[styles.totalRow, styles.totalLine, { borderTopColor: c.line }]}>
                <Text style={[styles.totalText, styles.grow, { color: c.fg }]}>Left to pay</Text>
                <Text style={[styles.totalText, styles.amount, { color: c.fg }]}>{formatUsd(left)}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Section title={f.customer.name}>
          <Text style={[parts.body, { color: c.fg }]}>
            {owes > 0 ? `Owes you ${formatUsd(owes)} in all.` : 'Owes you nothing now.'}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

type PdfState = 'making' | 'ready' | 'failed';

/** The PDF, made once at issue: Share once it is ready; what went wrong if it could not be made or sent. */
export function PdfPart({ id, number }: { id: string; number: string }) {
  const c = useColours();
  const db = useDb();
  const d = useDocuments();
  const [state, setState] = useState<PdfState>(() => (d.issued(id).pdfFileId ? 'ready' : 'making'));
  const [problem, setProblem] = useState<string | null>(null);

  const make = useCallback(() => {
    setState(d.issued(id).pdfFileId ? 'ready' : 'making');
    setProblem(null);
    let live = true;
    invoicePdf(db, d, id).then(
      () => live && setState('ready'),
      (e: unknown) => {
        db.logError('invoice pdf', e);
        console.warn('MHIZHA_PDF_ERROR ' + (e instanceof Error ? e.message : String(e)));
        if (!live) return;
        setState('failed');
        const text = `The PDF of ${number} could not be made. Tap Try again.`;
        setProblem(text);
        AccessibilityInfo.announceForAccessibility(text);
      },
    );
    return () => {
      live = false;
    };
  }, [d, db, id, number]);
  useEffect(make, [make]);

  const share = () => {
    setProblem(null);
    shareInvoicePdf(db, d, id).catch((e: unknown) => {
      db.logError('share pdf', e);
      const text = 'The PDF could not be shared. Try again; if it keeps happening, send a problem report from Settings.';
      setProblem(text);
      AccessibilityInfo.announceForAccessibility(text);
    });
  };

  return (
    <View style={styles.pdf}>
      {state === 'ready' ? <Button primary label="Share PDF" onPress={share} /> : null}
      {state === 'making' ? (
        <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.label }]}>
          Making the PDF…
        </Text>
      ) : null}
      {problem ? (
        <Text accessibilityLiveRegion="polite" style={[parts.small, styles.strong, { color: c.bad }]}>
          {`! ${problem}`}
        </Text>
      ) : null}
      {state === 'failed' ? <Button label="Try again" onPress={make} /> : null}
    </View>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  const c = useColours();
  return (
    <View style={styles.totalRow}>
      <Text style={[parts.body, styles.grow, { color: c.label }]}>{k}</Text>
      <Text style={[styles.amount, { color: c.fg }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8, gap: space.s4 },
  head: { gap: space.s1 },
  pdf: { gap: space.s2 },
  number: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  strong: { fontWeight: '600' },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  totals: { gap: space.s1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3 },
  totalLine: { borderTopWidth: size.hairline, paddingTop: space.s2, marginTop: space.s1 },
  totalText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  grow: { flex: 1 },
});
