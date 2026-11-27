import { useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd, parseUsd, type PaymentMethod } from '../../core';
import { PdfPart } from '../../documents/screens/DocumentScreen';
import { InputError } from '../../people';
import { usePeople, type Nav } from '../../people/screens/common';
import { longDate, longDateTime, todayAt } from '../../setup/dates';
import { Choice, TextField } from '../../ui/fields';
import { DateField, List, Row } from '../../ui/forms';
import { SubTopBar, styles as parts } from '../../ui/parts';
import { StepFoot } from '../../ui/steps';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import type { RefundInput, RefundSource } from '..';
import { usePayments } from './PaymentScreen';

// Paying back money held for a Customer (spec section 6): an unused Deposit
// on one of their Quotations, or their Credit, up to what is held, with the
// date, how it was paid back and why. Issuing makes Refund REF-0001, locked.
// Then one Refund: what it paid back, from where, and its PDF.

const keyOf = (s: RefundSource) => (s.kind === 'credit' ? 'credit' : s.quotationId);

export function RefundScreen({ customerId, quotationId, nav }: { customerId: string; quotationId?: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const pay = usePayments();
  const today = todayAt(Date.now());
  const customer = p.customer(customerId);
  const [sources] = useState(() => pay.refundSources(customerId));
  const shownMethods = pay.methods().filter((m) => !m.hidden);
  const first = sources.find((s) => s.kind === 'deposit' && s.quotationId === quotationId) ?? sources[0];
  const [from, setFrom] = useState<string>(first ? keyOf(first) : 'credit');
  const source = sources.find((s) => keyOf(s) === from);
  const [amountText, setAmountText] = useState(first ? (first.held / 100).toFixed(2) : '');
  const [date, setDate] = useState(today);
  const startMethod = first?.method && shownMethods.some((m) => m.code === first.method) ? first.method : (shownMethods[0]?.code ?? 'cash');
  const [method, setMethod] = useState<PaymentMethod>(startMethod);
  const [other, setOther] = useState('');
  const [reason, setReason] = useState('');
  const [problems, setProblems] = useState<Record<string, string>>({});

  const parsed = amountText.trim() === '' ? null : parseUsd(amountText);
  const input: RefundInput = {
    customerId,
    from: source?.kind === 'deposit' ? { kind: 'deposit', quotationId: source.quotationId } : { kind: 'credit' },
    amount: parsed?.ok ? parsed.cents : 0,
    date,
    method,
    otherDescription: other,
    reason,
  };
  const number = pay.checkRefund(input).number;

  const pick = (key: string) => {
    setFrom(key);
    const s = sources.find((x) => keyOf(x) === key);
    if (s) {
      setAmountText((s.held / 100).toFixed(2));
      if (s.method && shownMethods.some((m) => m.code === s.method)) setMethod(s.method);
    }
    setProblems({});
  };

  const save = () => {
    const found = { ...pay.checkRefund(input).problems };
    if (parsed && !parsed.ok) found.amount = parsed.message;
    if (Object.keys(found).length > 0) {
      setProblems(found);
      AccessibilityInfo.announceForAccessibility(`Not issued. ${Object.values(found).join(' ')}`);
      return;
    }
    try {
      const id = pay.refund(input);
      nav.replace({ screen: 'document', id });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setProblems(e.problems);
      AccessibilityInfo.announceForAccessibility(`Not issued. ${e.message}`);
    }
  };

  return (
    <View style={styles.screen}>
      <SubTopBar title="Refund" onBack={nav.back} />
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
          <View style={styles.head}>
            <Text style={[parts.small, { color: c.label }]}>Pay back to</Text>
            <Text accessibilityRole="header" style={[styles.question, { color: c.fg }]}>
              {customer.name}
            </Text>
          </View>
          {sources.length === 0 ? (
            <Text style={[parts.body, { color: c.label }]}>
              {`You hold no Deposit or Credit for ${customer.name}, so there is nothing to pay back.`}
            </Text>
          ) : (
            <>
              <Choice<string>
                label="What you pay back"
                options={sources.map((s) => ({ value: keyOf(s), label: `${s.title} (${formatUsd(s.held)})` }))}
                value={from}
                onChange={pick}
                error={problems.from}
              />
              <TextField
                label="Amount paid back (US$)"
                hint={source ? `Up to ${formatUsd(source.held)}, all of what is held.` : undefined}
                value={amountText}
                onChange={(t) => {
                  setAmountText(t);
                  setProblems({});
                }}
                error={problems.amount}
                keyboardType="decimal-pad"
              />
              <DateField label="Date paid back" hint="Today, or an earlier day" value={date} max={today} onChange={setDate} error={problems.date} />
              <Choice<PaymentMethod>
                label="How you paid it back"
                options={shownMethods.map((m) => ({ value: m.code, label: m.name }))}
                value={method}
                onChange={setMethod}
                error={problems.method}
              />
              {method === 'other' ? (
                <TextField label="Describe how you paid it back" hint='For example "Cheque"' value={other} onChange={setOther} error={problems.other} />
              ) : null}
              <TextField
                label="Reason"
                hint="Printed on the Refund, for example “Job dropped before work started”"
                value={reason}
                onChange={setReason}
                error={problems.reason}
              />
              {problems.clock ? <ProblemText text={problems.clock} /> : null}
              {problems.business ? <ProblemText text={problems.business} /> : null}
              <Text style={[parts.small, { color: c.label }]}>
                {`Issuing makes Refund ${number}. It can't be changed; a mistake is put right by cancelling it.`}
              </Text>
            </>
          )}
        </ScrollView>
        {sources.length > 0 ? <StepFoot onBack={nav.back} next={{ label: `Issue Refund ${number}`, onPress: save }} /> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** An Issued Refund: what was paid back, to whom, when, how and why, and its PDF. */
export function RefundDocumentScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const pay = usePayments();
  const r = pay.refundDoc(id);
  const facts: [string, string][] = [
    ['Issued', longDateTime(r.issuedAt)],
    ['Date paid back', longDate(r.date)],
    ['How it was paid back', r.method],
    ['Refund of', r.refundOf],
    ['Reason', r.reason],
  ];
  return (
    <View style={styles.screen}>
      <SubTopBar title={r.number} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.head}>
          <Text style={[parts.small, { color: c.label }]}>Refund</Text>
          <Text accessibilityRole="header" style={[styles.question, { color: c.fg }]}>
            {r.number}
          </Text>
          <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`Refunded · ${formatUsd(r.amount)}`}</Text>
          <Text style={[parts.body, { color: c.label }]}>{`Paid back to ${r.customerName}`}</Text>
        </View>
        <PdfPart id={id} number={r.number} />
        <List>
          {facts.map(([k, v], i) => (
            <Row key={k} first={i === 0} title={v} subtitle={k} label={`${k}: ${v}`} />
          ))}
        </List>
        <Text style={[parts.small, { color: c.label }]}>{r.sumInWords}</Text>
      </ScrollView>
    </View>
  );
}

function ProblemText({ text }: { text: string }) {
  const c = useColours();
  return (
    <Text accessibilityLiveRegion="polite" style={[parts.small, styles.problem, { color: c.bad }]}>
      {`! ${text}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8, gap: space.s4 },
  head: { gap: space.s1 },
  question: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  strong: { fontWeight: '600' },
  problem: { fontWeight: '700' },
});
