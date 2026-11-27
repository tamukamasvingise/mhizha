import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fillOldestFirst, formatUsd, parseUsd, type Cents, type PaymentMethod } from '../../core';
import { shortDate } from '../../dates';
import { customerOwes } from '../../ledger';
import { InputError } from '../../people';
import { usePeople, type Nav } from '../../people/screens/common';
import { useDb } from '../../shell/Records';
import { longDate, todayAt } from '../../setup/dates';
import { Choice, TextField, Toggle } from '../../ui/fields';
import { DateField, List, Row, Section, SmallButton } from '../../ui/forms';
import { Button, Sheet, SubTopBar, Tappable, styles as parts } from '../../ui/parts';
import { StepFoot } from '../../ui/steps';
import { useColours } from '../../ui/theme';
import { lineHeight, radius, size, space, type } from '../../ui/tokens';
import { payments, type PaymentInput } from '..';

// Recording a Payment (spec section 6): who paid, how much, when and how,
// then what it pays: open Invoices oldest first, then Deposits on accepted
// Quotations. "Check Payment" shows what will be saved; "Save and issue
// Receipt" saves it and issues the Receipt in one go.

/** One thing a Payment can pay: an open Invoice, or a Deposit on an accepted Quotation. */
type Payable = {
  id: string;
  kind: 'invoice' | 'deposit';
  /** "INV-0001", or "Deposit on QUO-0001". */
  title: string;
  subtitle: string;
  /** The most this Payment can put on it. */
  owed: Cents;
  /** What is filled in for it unless the User changes it. */
  suggested: Cents;
  overdue: boolean;
  jobTitle: string;
};

export function usePayments() {
  const db = useDb();
  return useMemo(() => payments(db, Date.now), [db]);
}

/** New Payment: picks the Customer first when none is given. From a Quotation, its Deposit is ticked. */
export function PaymentScreen({ customerId, quotationId, nav }: { customerId?: string; quotationId?: string; nav: Nav }) {
  return customerId ? <PaymentForm customerId={customerId} quotationId={quotationId} nav={nav} /> : <PickCustomer nav={nav} />;
}

function PickCustomer({ nav }: { nav: Nav }) {
  const c = useColours();
  const db = useDb();
  const p = usePeople();
  const [search, setSearch] = useState('');
  const all = p.customers();
  const shown = p.customers({ search });
  return (
    <View style={styles.screen}>
      <SubTopBar title="Payment from" onBack={nav.back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
        <Text accessibilityRole="header" style={[styles.question, { color: c.fg }]}>
          Who paid you?
        </Text>
        {all.length === 0 ? (
          <>
            <Text style={[parts.body, { color: c.label }]}>No Customers yet. Add the Customer and invoice them first.</Text>
            <Button label="Add a Customer" onPress={() => nav.replace({ screen: 'customer-form' })} />
          </>
        ) : (
          <>
            {all.length > 5 ? <TextField label="Find a Customer" hint="Part of a name, or a phone number" value={search} onChange={setSearch} /> : null}
            {shown.length > 0 ? (
              <List>
                {shown.map((x, i) => {
                  const owes = customerOwes(db, x.id);
                  return (
                    <Row
                      key={x.id}
                      first={i === 0}
                      title={x.name}
                      subtitle={owes > 0 ? `Owes you ${formatUsd(owes)}` : 'Owes nothing'}
                      onPress={() => nav.replace({ screen: 'payment', customerId: x.id })}
                    />
                  );
                })}
              </List>
            ) : (
              <Text style={[parts.body, { color: c.label }]}>No Customer matches. Check the spelling, or try a phone number.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PaymentForm({ customerId, quotationId, nav }: { customerId: string; quotationId?: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const pay = usePayments();
  const today = todayAt(Date.now());
  const customer = p.customer(customerId);
  const [payables] = useState<Payable[]>(() => [
    ...pay.owing(customerId).map((o): Payable => ({
      id: o.id,
      kind: 'invoice',
      title: o.number,
      subtitle: `${o.jobTitle} · due ${shortDate(o.dueDate)} · ${formatUsd(o.owed)} owed`,
      owed: o.owed,
      suggested: o.owed,
      overdue: o.status === 'overdue',
      jobTitle: o.jobTitle,
    })),
    ...pay.deposits(customerId).map((x): Payable => ({
      id: x.quotationId,
      kind: 'deposit',
      title: `Deposit on ${x.number}`,
      subtitle: [
        x.jobTitle,
        x.asked ? `${formatUsd(x.asked)} asked` : '',
        x.held > 0 ? `${formatUsd(x.held)} held` : '',
        `up to ${formatUsd(x.room)}`,
      ]
        .filter(Boolean)
        .join(' · '),
      owed: x.room,
      suggested: x.suggested,
      overdue: false,
      jobTitle: x.jobTitle,
    })),
  ]);
  const owing = payables.filter((x) => x.kind === 'invoice');
  const deposits = payables.filter((x) => x.kind === 'deposit');
  const shownMethods = pay.methods().filter((m) => !m.hidden);
  const [amountText, setAmountText] = useState('');
  const [dateReceived, setDateReceived] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>(shownMethods[0]?.code ?? 'cash');
  const [other, setOther] = useState('');
  // Open Invoices are ticked; Deposits only when nothing is owed. From a Quotation, only its Deposit.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(quotationId ? [quotationId] : (owing.length > 0 ? owing : deposits).map((o) => o.id)),
  );
  const [changed, setChanged] = useState<Readonly<Record<string, Cents>>>({});
  const [separate, setSeparate] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [changing, setChanging] = useState<Payable | null>(null);

  const parsed = amountText.trim() === '' ? null : parseUsd(amountText);
  const amount = parsed?.ok ? parsed.cents : 0;
  const split = fillOldestFirst(
    amount,
    payables.filter((o) => ticked.has(o.id)),
    { ...Object.fromEntries(deposits.map((x) => [x.id, x.suggested])), ...changed },
  );
  const onInvoice = new Map(split.parts.map((x) => [x.id, x.amount]));
  const input: PaymentInput = {
    customerId,
    amount,
    dateReceived,
    method,
    otherDescription: other,
    parts: split.parts.map((x) =>
      payables.find((y) => y.id === x.id)!.kind === 'deposit' ? { quotationId: x.id, amount: x.amount } : { invoiceId: x.id, amount: x.amount },
    ),
    separate,
  };

  // While checking, the phone's Back goes back to the form, not out of the Payment.
  useEffect(() => {
    if (!checking) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setChecking(false);
      return true;
    });
    return () => sub.remove();
  }, [checking]);

  const toCheck = () => {
    const found = { ...pay.check(input).problems };
    if (parsed && !parsed.ok) found.amount = parsed.message;
    setProblems(found);
    if (Object.keys(found).length > 0) {
      AccessibilityInfo.announceForAccessibility(`Not ready. ${Object.values(found).join(' ')}`);
      return;
    }
    setChecking(true);
  };

  if (checking) return <CheckPayment input={input} payables={payables} onChange={() => setChecking(false)} nav={nav} onProblems={(x) => {
    setProblems(x);
    setChecking(false);
  }} />;

  const toggle = (id: string) => {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
  };

  return (
    <View style={styles.screen}>
      <SubTopBar title="Record Payment" onBack={nav.back} />
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
          <View style={styles.head}>
            <Text style={[parts.small, { color: c.label }]}>From</Text>
            <Text accessibilityRole="header" style={[styles.question, { color: c.fg }]}>
              {customer.name}
            </Text>
          </View>
          {payables.length === 0 ? (
            <Text style={[parts.body, { color: c.label }]}>
              {`${customer.name} owes nothing now. A Payment is recorded against their Issued Invoices, or as a Deposit on an Accepted Quotation; issue one first.`}
            </Text>
          ) : (
            <>
              <TextField
                label="Amount received (US$)"
                value={amountText}
                onChange={(t) => {
                  setAmountText(t);
                  setProblems({});
                }}
                error={problems.amount}
                keyboardType="decimal-pad"
              />
              <DateField
                label="Date received"
                hint="Today, or an earlier day"
                value={dateReceived}
                max={today}
                onChange={setDateReceived}
                error={problems.dateReceived}
              />
              <Choice<PaymentMethod>
                label="How they paid"
                options={shownMethods.map((m) => ({ value: m.code, label: m.name }))}
                value={method}
                onChange={setMethod}
                error={problems.method}
              />
              {method === 'other' ? (
                <TextField label="Describe how they paid" hint='For example "Cheque"' value={other} onChange={setOther} error={problems.other} />
              ) : null}

              {owing.length > 0 ? (
                <Section title="What it pays, oldest first">
                  <List>
                    {owing.map((o, i) => (
                      <TickRow
                        key={o.id}
                        first={i === 0}
                        item={o}
                        ticked={ticked.has(o.id)}
                        amount={onInvoice.get(o.id) ?? 0}
                        onToggle={() => toggle(o.id)}
                        onChange={() => setChanging(o)}
                      />
                    ))}
                  </List>
                </Section>
              ) : null}
              {deposits.length > 0 ? (
                <Section title="Deposits on Accepted Quotations">
                  <List>
                    {deposits.map((o, i) => (
                      <TickRow
                        key={o.id}
                        first={i === 0}
                        item={o}
                        ticked={ticked.has(o.id)}
                        amount={onInvoice.get(o.id) ?? 0}
                        onToggle={() => toggle(o.id)}
                        onChange={() => setChanging(o)}
                      />
                    ))}
                  </List>
                  <Text style={[parts.small, { color: c.label }]}>A Deposit is held for the Customer and applied when you issue an Invoice from the Quotation.</Text>
                </Section>
              ) : null}
              {problems.parts ? <ProblemText text={problems.parts} /> : null}
              {split.left > 0 && amount > 0 ? (
                <View accessible accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`${formatUsd(split.left)} is more than the ticked items take`}</Text>
                  <Text style={[parts.small, { color: c.label }]}>Lower the amount, tick another item, or change an amount.</Text>
                </View>
              ) : null}
              {split.parts.length > 1 ? (
                <Toggle
                  label="Separate receipts"
                  hint="One Receipt for each Invoice or Deposit instead of one for all"
                  value={separate}
                  onChange={setSeparate}
                />
              ) : null}
              {problems.clock ? <ProblemText text={problems.clock} /> : null}
              {problems.business ? <ProblemText text={problems.business} /> : null}
            </>
          )}
        </ScrollView>
        {payables.length > 0 ? <StepFoot next={{ label: 'Check Payment', onPress: toCheck }} /> : null}
      </KeyboardAvoidingView>
      {changing ? (
        <ChangeAmount
          item={changing}
          current={onInvoice.get(changing.id) ?? 0}
          onClose={() => setChanging(null)}
          onSave={(cents) => {
            setChanged({ ...changed, [changing.id]: cents });
            setTicked(new Set([...ticked, changing.id]));
            setChanging(null);
          }}
          onReset={() => {
            const { [changing.id]: _, ...rest } = changed;
            setChanged(rest);
            setChanging(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** One open Invoice or Deposit: a tick box, what it takes, and what this Payment puts on it. */
function TickRow({
  item: o,
  ticked,
  amount,
  first,
  onToggle,
  onChange,
}: {
  item: Payable;
  ticked: boolean;
  amount: Cents;
  first: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const c = useColours();
  const subtitle = o.subtitle;
  return (
    <View style={[styles.tickRow, !first && { borderTopWidth: size.hairline, borderTopColor: c.line }]}>
      <Tappable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ticked }}
        accessibilityLabel={`${o.title}, ${subtitle}, ${formatUsd(amount)} from this Payment`}
        onPress={onToggle}
        style={({ pressed }) => [styles.tickMain, pressed && { backgroundColor: c.tint }]}
      >
        <View style={[styles.box, ticked ? { backgroundColor: c.sel, borderColor: c.brand } : { backgroundColor: c.surface, borderColor: c.input }]}>
          {ticked ? <Text style={[styles.boxTick, { color: c.selFg }]}>✓</Text> : null}
        </View>
        <View style={styles.grow}>
          <Text style={[styles.rowTitle, { color: c.fg }]}>{o.title}</Text>
          <Text style={[parts.small, { color: o.overdue ? c.bad : c.label }]}>
            {o.overdue ? `! Overdue · ${subtitle}` : subtitle}
          </Text>
        </View>
        <Text style={[styles.amount, { color: c.fg }]}>{formatUsd(amount)}</Text>
      </Tappable>
      {ticked ? (
        <View style={styles.changeButton}>
          <SmallButton label="Change amount" a11yLabel={`Change the amount on ${o.title}`} onPress={onChange} />
        </View>
      ) : null}
    </View>
  );
}

function ChangeAmount({
  item,
  current,
  onClose,
  onSave,
  onReset,
}: {
  item: Payable;
  current: Cents;
  onClose: () => void;
  onSave: (cents: Cents) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(current > 0 ? (current / 100).toFixed(2) : '');
  const [error, setError] = useState<string | undefined>();
  const save = () => {
    const parsed = parseUsd(text);
    if (!parsed.ok) return setError(parsed.message);
    if (parsed.cents > item.owed) return setError(limitText(item));
    onSave(parsed.cents);
  };
  return (
    <Sheet visible title={`Amount on ${item.title}`} onClose={onClose}>
      <TextField
        label="Amount from this Payment (US$)"
        hint={`${limitText(item)} The rest of the Payment goes on the other ticked items.`}
        value={text}
        onChange={(t) => {
          setText(t);
          setError(undefined);
        }}
        error={error}
        keyboardType="decimal-pad"
      />
      <Button primary label="Use this amount" onPress={save} />
      <Button label="Fill oldest first again" onPress={onReset} />
    </Sheet>
  );
}

/** "INV-0001 owes US$100.00. Put no more than that on it." or the most a Deposit can be. */
function limitText(item: Payable): string {
  return item.kind === 'deposit'
    ? `${item.title.replace('Deposit on', 'A Deposit on')} can be at most ${formatUsd(item.owed)}.`
    : `${item.title} owes ${formatUsd(item.owed)}. Put no more than that on it.`;
}

/** What will be saved, before it is: the amount, how and when, what it pays, and the Receipts it issues. */
function CheckPayment({
  input,
  payables,
  onChange,
  onProblems,
  nav,
}: {
  input: PaymentInput;
  payables: readonly Payable[];
  onChange: () => void;
  onProblems: (problems: Record<string, string>) => void;
  nav: Nav;
}) {
  const c = useColours();
  const p = usePeople();
  const pay = usePayments();
  const checked = pay.check(input);
  const name = p.customer(input.customerId).name;
  const method = pay.methods().find((m) => m.code === input.method)!.name;
  const how = input.method === 'other' ? `${method}: ${input.otherDescription.trim()}` : method;
  const many = checked.receipts.length > 1;
  const save = () => {
    try {
      const ids = pay.record(input);
      nav.replace({ screen: 'document', id: ids.at(-1)! });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      AccessibilityInfo.announceForAccessibility(`Not saved. ${e.message}`);
      onProblems(e.problems);
    }
  };
  return (
    <View style={styles.screen}>
      <SubTopBar title="Check Payment" onBack={onChange} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.head} accessible accessibilityLabel={`${name} paid ${formatUsd(input.amount)}, ${how}, received ${longDate(input.dateReceived)}`}>
          <Text style={[parts.body, { color: c.label }]}>{`${name} paid`}</Text>
          <Text style={[styles.big, { color: c.fg }]}>{formatUsd(input.amount)}</Text>
          <Text style={[parts.body, { color: c.label }]}>{`${how} · received ${longDate(input.dateReceived)}`}</Text>
        </View>
        <List>
          {input.parts.map((x, i) => {
            const id = 'quotationId' in x ? x.quotationId : x.invoiceId;
            const o = payables.find((y) => y.id === id)!;
            return (
              <Row
                key={id}
                first={i === 0}
                title={`${o.title} · ${o.jobTitle}`}
                subtitle={
                  o.kind === 'deposit'
                    ? 'Held as a Deposit until the Invoice'
                    : o.owed - x.amount > 0
                      ? `Left to pay: ${formatUsd(o.owed - x.amount)}`
                      : '✓ Paid in full'
                }
                right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(x.amount)}</Text>}
              />
            );
          })}
        </List>
        {checked.warnings.map((w) => (
          <View key={w} accessible style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[parts.body, styles.strong, { color: c.fg }]}>An earlier year</Text>
            <Text style={[parts.small, { color: c.label }]}>{w}</Text>
          </View>
        ))}
        <Text style={[parts.body, { color: c.label }]}>
          {`Saving issues ${many ? `${checked.receipts.length} Receipts, ${checked.receipts.join(', ')}, one for each part` : `Receipt ${checked.receipts[0]}`}. A Receipt can't be changed; a mistake is put right by cancelling it.`}
        </Text>
      </ScrollView>
      <StepFoot onBack={onChange} next={{ label: many ? 'Save and issue Receipts' : 'Save and issue Receipt', onPress: save }} />
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
  big: { fontSize: type.xl, lineHeight: lineHeight(type.xl), fontWeight: '700', fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '600' },
  grow: { flex: 1, gap: space.s05 },
  rowTitle: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600' },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  tickRow: { paddingBottom: space.s1 },
  tickMain: { minHeight: size.topBar, padding: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  box: {
    width: size.icon + space.s1,
    height: size.icon + space.s1,
    borderRadius: radius.r,
    borderWidth: size.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTick: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '700' },
  changeButton: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.s3, paddingBottom: space.s2 },
  notice: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s05 },
  problem: { fontWeight: '700' },
});
