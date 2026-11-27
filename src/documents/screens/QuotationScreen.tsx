import { useReducer, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { InputError } from '../../people';
import type { Nav } from '../../people/screens/common';
import { invoiceSteps } from '../../shell/navigation';
import { longDate, longDateTime, todayAt } from '../../setup/dates';
import { TextField } from '../../ui/fields';
import { DateField, List, Row, Section } from '../../ui/forms';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, radius, size, space, type } from '../../ui/tokens';
import type { Quotation } from '..';
import { DocumentList, isBad, STATUS_WORDS, useDocuments } from './common';
import { LinesAndTotals, PdfPart } from './DocumentScreen';

// One Issued Quotation: its status and the User's answer, the next thing to
// do (mark it Accepted, make an Invoice from it), what was invoiced and what
// remains, its PDF, terms, lines and Revisions. Rare actions (Declined,
// Revision, taking back Accepted, Cancel) sit under the main one.

type SheetKind = 'accept' | 'accept-then-invoice' | 'decline' | 'undo' | 'cancel' | null;

export function QuotationScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const d = useDocuments();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const q = d.quotation(id);
  const f = q.frozen;
  const today = todayAt(Date.now());
  const invoiced = q.invoices.some((i) => !i.draft);

  const attempt = (fn: () => void, done?: string) => {
    try {
      fn();
      setSheet(null);
      setProblem(null);
      refresh();
      if (done) AccessibilityInfo.announceForAccessibility(done);
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      const text = Object.values(e.problems).join(' ');
      setSheet(null);
      setProblem(text);
      AccessibilityInfo.announceForAccessibility(text);
    }
  };
  /** A Draft Invoice from it, opened at its lines with the steps before behind them. */
  const makeInvoice = () =>
    attempt(() => {
      const draftId = d.invoiceFrom(id);
      for (const step of invoiceSteps.slice(0, 3)) nav.open({ screen: 'invoice-step', step, id: draftId });
    });
  const revise = () =>
    attempt(() => {
      const draftId = d.revise(id);
      for (const step of invoiceSteps.slice(0, 3)) nav.open({ screen: 'invoice-step', step, id: draftId });
    });

  const facts: [string, string][] = [
    ['Issued', longDateTime(q.issuedAt)],
    ['Valid until', longDate(q.validUntil)],
  ];
  if (q.depositAsked) facts.push(['Deposit asked', formatUsd(q.depositAsked)]);
  if (q.depositHeld > 0) facts.push(['Deposit held', `${formatUsd(q.depositHeld)}, applied when you issue an Invoice from it`]);
  if (q.leadTime) facts.push(['Lead time', q.leadTime]);

  const open = q.status === 'issued' || q.status === 'expired' || q.status === 'declined';
  return (
    <View style={styles.screen}>
      <SubTopBar title={q.number} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.head}>
          <Text style={[parts.small, { color: c.label }]}>Quotation</Text>
          <Text accessibilityRole="header" style={[styles.number, { color: c.fg }]}>
            {q.number}
          </Text>
          <Text style={[parts.body, styles.strong, { color: isBad(q.status) ? c.bad : c.fg }]}>
            {`${STATUS_WORDS[q.status]} · ${formatUsd(q.total)}`}
          </Text>
          <Text style={[parts.body, { color: c.label }]}>{`${f.customer.name} · ${f.job.title}`}</Text>
          <Text style={[parts.body, { color: c.fg }]}>{statusLine(q, today)}</Text>
        </View>

        {problem ? (
          <Text accessibilityLiveRegion="polite" style={[parts.small, styles.problem, { color: c.bad }]}>
            {`! ${problem}`}
          </Text>
        ) : null}

        {q.status === 'expired' ? (
          <View accessible style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`This Quotation expired on ${longDate(q.validUntil)}.`}</Text>
            <Text style={[parts.small, { color: c.label }]}>You can still mark it Accepted, or make a Revision with new prices.</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {open ? (
            <>
              <Button primary label="Mark Accepted" onPress={() => setSheet('accept')} />
              <Button label="Make an Invoice" onPress={() => setSheet('accept-then-invoice')} />
              {q.status !== 'declined' ? <Button label="Mark Declined" onPress={() => setSheet('decline')} /> : null}
            </>
          ) : null}
          {q.status === 'accepted' ? <Button primary label="Make an Invoice" onPress={makeInvoice} /> : null}
          {q.status === 'accepted' && q.remaining - q.depositHeld > 0 ? (
            <Button label="Record Deposit" onPress={() => nav.open({ screen: 'payment', customerId: q.customerId, quotationId: id })} />
          ) : null}
          {open || (q.status === 'accepted' && !invoiced) ? (
            <Button label={q.draftRevisionId ? 'Go on with the Draft Revision' : 'Make a Revision'} onPress={revise} />
          ) : null}
          {q.status === 'accepted' && !invoiced ? <Button label="Take back Accepted" onPress={() => setSheet('undo')} /> : null}
          {q.status === 'superseded' && q.supersededBy ? (
            <Button
              primary
              label={`Open ${q.supersededBy}`}
              onPress={() => nav.open({ screen: 'document', id: q.revisions.find((r) => r.number === q.supersededBy)!.id })}
            />
          ) : null}
        </View>

        {q.status !== 'superseded' && q.status !== 'cancelled' ? <PdfPart id={id} number={q.number} /> : null}

        {q.invoices.length > 0 || q.status === 'accepted' ? (
          <Section title="Invoiced from it">
            <Text style={[parts.body, { color: c.fg }]}>
              {q.remaining >= 0
                ? `Invoiced ${formatUsd(q.invoiced)} · remaining ${formatUsd(q.remaining)}`
                : `Invoiced ${formatUsd(q.invoiced)}, ${formatUsd(-q.remaining)} more than the Quotation`}
            </Text>
            {q.invoices.length > 0 ? <DocumentList items={q.invoices} nav={nav} showCustomer={false} /> : null}
          </Section>
        ) : null}

        <List>
          {facts.map(([k, v], i) => (
            <Row key={k} first={i === 0} title={v} subtitle={k} label={`${k}: ${v}`} />
          ))}
        </List>

        <LinesAndTotals doc={q} />

        {q.revisions.length > 1 ? (
          <Section title="Versions">
            <List>
              {q.revisions.map((r, i) => (
                <Row
                  key={r.id}
                  first={i === 0}
                  title={r.id === id ? `${r.number} (this one)` : r.number}
                  subtitle={`${STATUS_WORDS[r.status].replace(/^[!✓] /, '')} · issued ${longDate(r.issueDate)}`}
                  onPress={r.id === id ? undefined : () => nav.open({ screen: 'document', id: r.id })}
                />
              ))}
            </List>
          </Section>
        ) : null}

        {q.status !== 'cancelled' && q.status !== 'superseded' && !invoiced ? (
          <Button danger label="Cancel Quotation" onPress={() => setSheet('cancel')} />
        ) : null}
      </ScrollView>

      <AnswerSheet
        visible={sheet === 'accept' || sheet === 'accept-then-invoice'}
        q={q}
        invoiceAfter={sheet === 'accept-then-invoice'}
        onClose={() => setSheet(null)}
        onDone={(date) =>
          attempt(() => {
            d.accept(id, date);
            if (sheet === 'accept-then-invoice') makeInvoice();
          }, `${q.number} marked Accepted.`)
        }
      />
      <DeclineSheet visible={sheet === 'decline'} q={q} onClose={() => setSheet(null)} onDone={(date) => attempt(() => d.decline(id, date), `${q.number} marked Declined.`)} />
      <Sheet visible={sheet === 'undo'} title="Take back Accepted?" onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>{`${q.number} goes back to waiting for an answer. Nothing is invoiced from it yet.`}</Text>
        <DepositMoves q={q} />
        <Button primary label="Take back Accepted" onPress={() => attempt(() => d.undoAccept(id), `${q.number} is waiting for an answer again.`)} />
      </Sheet>
      <CancelSheet visible={sheet === 'cancel'} q={q} onClose={() => setSheet(null)} onDone={(reason) => attempt(() => d.cancelQuotation(id, reason), `${q.number} cancelled.`)} />
    </View>
  );
}

/** Before taking back Accepted, declining or cancelling: the Deposit held on it moves to the Customer's Credit. */
function DepositMoves({ q }: { q: Quotation }) {
  const c = useColours();
  if (q.depositHeld === 0) return null;
  return (
    <View accessible style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`The ${formatUsd(q.depositHeld)} Deposit moves to Credit`}</Text>
      <Text style={[parts.small, { color: c.label }]}>
        It stays the Customer's money, held for them. You can apply it to another Invoice or refund it.
      </Text>
    </View>
  );
}

/** The status in a sentence: when it was answered, why it was cancelled, or what replaced it. */
function statusLine(q: Quotation, today: string): string {
  switch (q.status) {
    case 'accepted':
      return `Accepted on ${longDate(q.answer!.date)}.`;
    case 'declined':
      return `Declined on ${longDate(q.answer!.date)}. It can still be marked Accepted.`;
    case 'cancelled':
      return `Cancelled on ${longDate(q.cancelled!.date)}: ${q.cancelled!.reason}`;
    case 'superseded':
      return `Replaced by ${q.supersededBy}.`;
    case 'expired':
      return `Waiting for an answer. Valid until ${longDate(q.validUntil)}.`;
    case 'issued':
      return q.validUntil === today ? 'Waiting for an answer. Valid until today.' : `Waiting for an answer. Valid until ${longDate(q.validUntil)}.`;
  }
}

/** The day the Customer accepted: today by default, not before the issue date, never later than today. Warns after expiry. */
function AnswerSheet({
  visible,
  q,
  invoiceAfter,
  onClose,
  onDone,
}: {
  visible: boolean;
  q: Quotation;
  invoiceAfter: boolean;
  onClose: () => void;
  onDone: (date: string) => void;
}) {
  const c = useColours();
  const d = useDocuments();
  const today = todayAt(Date.now());
  const [date, setDate] = useState(today);
  const warning = d.acceptWarning(q.id, date);
  return (
    <Sheet visible={visible} title={invoiceAfter ? `Accept ${q.number} first?` : `Mark ${q.number} Accepted`} onClose={onClose}>
      {invoiceAfter ? (
        <Text style={[parts.body, { color: c.fg }]}>An Invoice comes from an Accepted Quotation. Mark it Accepted, then the Draft Invoice opens.</Text>
      ) : null}
      {warning ? (
        <View accessible style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[parts.body, styles.strong, { color: c.fg }]}>{warning}</Text>
        </View>
      ) : null}
      <DateField label="Date accepted" value={date} min={q.issueDate} max={today} onChange={setDate} />
      <Button primary label={invoiceAfter ? 'Mark Accepted and make the Invoice' : 'Mark Accepted'} onPress={() => onDone(date)} />
    </Sheet>
  );
}

function DeclineSheet({ visible, q, onClose, onDone }: { visible: boolean; q: Quotation; onClose: () => void; onDone: (date: string) => void }) {
  const c = useColours();
  const today = todayAt(Date.now());
  const [date, setDate] = useState(today);
  return (
    <Sheet visible={visible} title={`Mark ${q.number} Declined`} onClose={onClose}>
      <Text style={[parts.body, { color: c.fg }]}>It stays in your records, and can still be marked Accepted if the Customer changes their mind.</Text>
      <DepositMoves q={q} />
      <DateField label="Date declined" value={date} min={q.issueDate} max={today} onChange={setDate} />
      <Button primary label="Mark Declined" onPress={() => onDone(date)} />
    </Sheet>
  );
}

function CancelSheet({ visible, q, onClose, onDone }: { visible: boolean; q: Quotation; onClose: () => void; onDone: (reason: string) => void }) {
  const c = useColours();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <Sheet visible={visible} title={`Cancel ${q.number}?`} onClose={onClose}>
      <Text style={[parts.body, { color: c.fg }]}>
        For a Quotation issued by mistake. It stays in your records marked Cancelled, and its number is never used again.
      </Text>
      <DepositMoves q={q} />
      <TextField label="Why is it cancelled?" hint='For example "Sent to the wrong Customer"' value={reason} onChange={setReason} error={error} />
      <Button
        danger
        label={`Cancel ${q.number}`}
        onPress={() => {
          if (reason.trim() === '') {
            setError('Say why it is cancelled.');
            AccessibilityInfo.announceForAccessibility('Not cancelled. Say why it is cancelled.');
            return;
          }
          onDone(reason);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { padding: space.s4, paddingBottom: space.s8, gap: space.s4 },
  head: { gap: space.s1 },
  actions: { gap: space.s2 },
  number: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  strong: { fontWeight: '600' },
  problem: { fontWeight: '700' },
  notice: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s1 },
});
