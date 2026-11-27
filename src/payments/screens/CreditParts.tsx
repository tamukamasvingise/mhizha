import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { formatUsd, parseUsd } from '../../core';
import { InputError } from '../../people';
import type { Nav } from '../../people/screens/common';
import { TextField } from '../../ui/fields';
import { List, Row, Section } from '../../ui/forms';
import { Button, Sheet, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, radius, size, space, type } from '../../ui/tokens';
import { usePayments } from './PaymentScreen';

// Credit on the screens (spec section 6): Deposits and Credit are the
// Customer's money, shown apart from what they owe and never taken off it
// unless the User says so. Credit is suggested on an Invoice with money
// owing, and on the Customer; applying it issues a "Credit applied" Receipt.

/** On an Invoice with money owing: "Tendai has US$50.00 Credit", and Apply Credit, which asks how much first. */
export function CreditOffer({ invoiceId, customerName, nav }: { invoiceId: string; customerName: string; nav: Nav }) {
  const c = useColours();
  const pay = usePayments();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { held, most } = pay.creditFor(invoiceId);
  if (most <= 0) return null;
  const start = () => {
    setText((most / 100).toFixed(2));
    setError(undefined);
    setOpen(true);
  };
  const apply = () => {
    const parsed = parseUsd(text);
    if (!parsed.ok) return setError(parsed.message);
    try {
      const receipt = pay.applyCredit(invoiceId, parsed.cents);
      setOpen(false);
      AccessibilityInfo.announceForAccessibility(`Credit applied. ${formatUsd(parsed.cents)}.`);
      nav.open({ screen: 'document', id: receipt });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setError(Object.values(e.problems).join(' '));
    }
  };
  return (
    <View accessible={false} style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`${customerName} has ${formatUsd(held)} Credit with you`}</Text>
      <Text style={[parts.small, { color: c.label }]}>It is their money. Apply it to this Invoice only if they agree.</Text>
      <Button label={`Apply ${formatUsd(most)} Credit`} onPress={start} />
      <Sheet visible={open} title="Apply Credit" onClose={() => setOpen(false)}>
        <TextField
          label="Credit to apply (US$)"
          hint={`At most ${formatUsd(most)}. A "Credit applied" Receipt is issued; no new money is received.`}
          value={text}
          onChange={(t) => {
            setText(t);
            setError(undefined);
          }}
          error={error}
          keyboardType="decimal-pad"
        />
        <Button primary label="Apply Credit and issue Receipt" onPress={apply} />
      </Sheet>
    </View>
  );
}

/**
 * On the Customer: the money held for them, each Deposit and their Credit
 * apart from what they owe, with Refund and (when they owe money) Apply
 * Credit to what they owe, which asks first.
 */
export function HeldForCustomer({
  customerId,
  customerName,
  owes,
  nav,
  onChanged,
}: {
  customerId: string;
  customerName: string;
  owes: number;
  nav: Nav;
  onChanged: (message: string) => void;
}) {
  const c = useColours();
  const pay = usePayments();
  const [asking, setAsking] = useState(false);
  const held = pay.refundSources(customerId);
  if (held.length === 0) return null;
  const credit = held.find((s) => s.kind === 'credit')?.held ?? 0;
  const toApply = Math.min(credit, owes);
  const apply = () => {
    try {
      const ids = pay.applyCreditToOwing(customerId);
      setAsking(false);
      onChanged(`Credit applied with ${ids.length === 1 ? 'one "Credit applied" Receipt' : `${ids.length} "Credit applied" Receipts`}.`);
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setAsking(false);
      onChanged(`Not applied. ${e.message}`);
    }
  };
  return (
    <Section title="Money you hold for them">
      <List>
        {held.map((s, i) => (
          <Row
            key={s.kind === 'credit' ? 'credit' : s.quotationId}
            first={i === 0}
            title={s.title}
            subtitle={s.kind === 'credit' ? 'Credit, kept for them' : 'Deposit, held until the Invoice'}
            right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(s.held)}</Text>}
            onPress={s.kind === 'deposit' ? () => nav.open({ screen: 'document', id: s.quotationId }) : undefined}
          />
        ))}
      </List>
      <Text style={[parts.small, { color: c.label }]}>
        Money you hold is theirs until it is used. It is never taken off what they owe without you saying so.
      </Text>
      {toApply > 0 ? <Button label={`Apply ${formatUsd(toApply)} Credit to what they owe`} onPress={() => setAsking(true)} /> : null}
      <Button label="Refund money you hold" onPress={() => nav.open({ screen: 'refund', customerId })} />
      <Sheet visible={asking} title="Apply Credit to what they owe?" onClose={() => setAsking(false)}>
        <Text style={[parts.body, { color: c.fg }]}>
          {`${formatUsd(toApply)} of ${customerName}'s Credit goes on their open Invoices, oldest first, with a "Credit applied" Receipt for each. No new money is received.`}
        </Text>
        <Button primary label={`Apply ${formatUsd(toApply)} Credit`} onPress={apply} />
      </Sheet>
    </Section>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s2 },
  strong: { fontWeight: '600' },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
});
