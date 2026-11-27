import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatUsd, parseUsd } from '../../core';
import { shortDate } from '../../dates';
import { InputError } from '../../people';
import { usePeople } from '../../people/screens/common';
import { useDb } from '../../shell/Records';
import { longDate } from '../../setup/dates';
import { startDate } from '../../setup/store';
import { Choice, TextField } from '../../ui/fields';
import { DateField, List, Row, SmallButton } from '../../ui/forms';
import { Button, Sheet, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import {
  monthName,
  openingBalances,
  openingLine,
  readMonthTotals,
  salesBeforeStart,
  setSalesBeforeStart,
  type OpeningItem,
  type OpeningKind,
  type Openings,
} from '..';

// The Opening balance parts the Customer screen, the setup step and Settings
// share: the list of items, the sheet that adds one, the sheet that shows one
// (Record Payment, make its Credit a Deposit, Cancel), and the months of sales
// before the Start date.

export function useOpenings(): Openings {
  const db = useDb();
  return useMemo(() => openingBalances(db, Date.now), [db]);
}

/** The item's title in a list: "Opening balance · invoice 1234", with the Customer's name where asked. */
function itemTitle(x: OpeningItem, withCustomer: boolean): string {
  const title = x.oldNumber ? `Opening balance · invoice ${x.oldNumber}` : 'Opening balance';
  return withCustomer ? `${x.customerName} · ${title}` : title;
}

function itemSubtitle(x: OpeningItem): string {
  const amount = x.kind === 'owed' ? `${formatUsd(x.left)} owed` : `${formatUsd(x.amount)} held for them`;
  const state =
    x.status === 'cancelled'
      ? 'Cancelled'
      : x.status === 'paid'
        ? '✓ Paid'
        : x.status === 'used'
          ? `Deposit on ${x.depositOn ?? 'a Quotation'}`
          : x.kind === 'owed' && x.left < x.amount
            ? `${formatUsd(x.amount - x.left)} paid`
            : '';
  return [x.oldDate ? shortDate(x.oldDate) : '', x.status === 'cancelled' ? formatUsd(x.amount) : amount, x.jobTitle, state]
    .filter(Boolean)
    .join(' · ');
}

/** Items as list rows; tapping one opens its sheet. */
export function OpeningList({
  items,
  withCustomer = false,
  onOpen,
}: {
  items: readonly OpeningItem[];
  withCustomer?: boolean;
  onOpen?: (x: OpeningItem) => void;
}) {
  return (
    <List>
      {items.map((x, i) => (
        <Row
          key={x.id}
          first={i === 0}
          title={itemTitle(x, withCustomer)}
          subtitle={itemSubtitle(x)}
          label={`${withCustomer ? `${x.customerName}, ` : ''}${openingLine(x)}${x.status === 'cancelled' ? ', Cancelled' : ''}`}
          onPress={onOpen ? () => onOpen(x) : undefined}
        />
      ))}
    </List>
  );
}

const NEW_CUSTOMER = '__new';

/**
 * Adds an Opening balance item. Given a Customer, it is for them; otherwise
 * (in setup) the User picks a Customer or types a new one's name.
 */
export function AddOpeningSheet({
  visible,
  customerId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  customerId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const c = useColours();
  const db = useDb();
  const p = usePeople();
  const ob = useOpenings();
  const start = startDate(db);
  const customers = customerId ? [] : p.customers();
  const [who, setWho] = useState<string>(customerId ?? customers[0]?.id ?? NEW_CUSTOMER);
  const [newName, setNewName] = useState('');
  const [kind, setKind] = useState<OpeningKind>('owed');
  const [oldNumber, setOldNumber] = useState('');
  const [oldDate, setOldDate] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [jobId, setJobId] = useState('');
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    // Each time it opens, it starts empty.
    setWasVisible(visible);
    if (visible) {
      setWho(customerId ?? customers[0]?.id ?? NEW_CUSTOMER);
      setNewName('');
      setKind('owed');
      setOldNumber('');
      setOldDate('');
      setAmountText('');
      setNote('');
      setJobId('');
      setProblems({});
    }
  }
  const jobs = who === NEW_CUSTOMER ? [] : p.jobs(who);

  const save = () => {
    const parsed = parseUsd(amountText);
    const found: Record<string, string> = {};
    if (!parsed.ok) found.amount = amountText.trim() === '' ? 'Enter the amount, more than US$0.00.' : parsed.message;
    if (who === NEW_CUSTOMER && newName.trim() === '') found.newName = "Enter the Customer's name.";
    if (Object.keys(found).length) return setProblems(found);
    try {
      db.transaction(() => {
        const id =
          who === NEW_CUSTOMER
            ? p.addCustomer({
                kind: 'person', name: newName, phones: [], whatsapp: '', email: '',
                address: { lines: '', suburb: '', city: '', province: '', country: '' }, taxNumber: '', firstSiteName: '', note: '',
              })
            : who;
        ob.add({
          customerId: id,
          kind,
          oldNumber,
          oldDate: oldDate || null,
          amount: parsed.ok ? parsed.cents : 0,
          note,
          jobId: jobId || null,
        });
      });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      return setProblems(e.problems);
    }
    onSaved(`Opening balance of ${formatUsd(parsed.ok ? parsed.cents : 0)} added.`);
  };

  return (
    <Sheet visible={visible} title="Add opening balance" onClose={onClose}>
      <Text style={[parts.body, { color: c.label }]}>
        {`From your old records: money a customer owed you, or you held for them, on your Start date, ${longDate(start)}.`}
      </Text>
      {customerId ? null : (
        <>
          {customers.length > 0 ? (
            <Choice<string>
              label="Customer"
              options={[...customers.map((x) => ({ value: x.id, label: x.name })), { value: NEW_CUSTOMER, label: 'A new Customer' }]}
              value={who}
              onChange={(v) => {
                setWho(v);
                setJobId('');
              }}
            />
          ) : null}
          {who === NEW_CUSTOMER ? (
            <TextField
              label="Customer's name"
              hint="You can add their phone and address later, from the Customer."
              value={newName}
              onChange={setNewName}
              error={problems.newName ?? problems.name}
              autoCapitalize="words"
            />
          ) : null}
        </>
      )}
      <Choice<OpeningKind>
        label="What was it?"
        options={[
          { value: 'owed', label: 'They owed me' },
          { value: 'credit', label: 'I held their money' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TextField label="Old invoice number (optional)" value={oldNumber} onChange={setOldNumber} />
      <DateField
        label="Date of the old invoice (optional)"
        value={oldDate}
        max={start}
        onChange={setOldDate}
        error={problems.oldDate}
        empty="No date"
      />
      {oldDate ? (
        <View style={local.buttons}>
          <SmallButton label="No date" a11yLabel="Leave the old invoice date empty" onPress={() => setOldDate('')} />
        </View>
      ) : null}
      <TextField
        label={kind === 'owed' ? 'Amount still owed (US$)' : 'Amount you held (US$)'}
        value={amountText}
        onChange={setAmountText}
        error={problems.amount}
        keyboardType="decimal-pad"
      />
      <TextField
        label={kind === 'owed' ? 'Note (optional)' : 'What the money was for'}
        hint={kind === 'credit' ? 'For example "Deposit for the roof". It shows on the Customer.' : undefined}
        value={note}
        onChange={setNote}
        error={problems.note}
      />
      {jobs.length > 0 ? (
        <Choice<string>
          label="Job (optional)"
          options={[{ value: '', label: 'None' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
          value={jobId}
          onChange={setJobId}
          error={problems.jobId}
        />
      ) : null}
      {problems.clock ? <ProblemLine text={problems.clock} /> : null}
      <Button primary label="Save" onPress={save} />
    </Sheet>
  );
}

/**
 * One item: what it is, then what can be done with it. An item owed can be
 * paid (Record Payment); Credit held can become an Accepted Quotation's
 * Deposit; a wrong item is Cancelled with a reason and entered again.
 */
export function OpeningItemSheet({
  item,
  onClose,
  onChanged,
  onRecordPayment,
}: {
  item: OpeningItem | null;
  onClose: () => void;
  onChanged: (message: string) => void;
  onRecordPayment?: () => void;
}) {
  const c = useColours();
  const ob = useOpenings();
  const [reason, setReason] = useState('');
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [openFor, setOpenFor] = useState<string | null>(null);
  if ((item?.id ?? null) !== openFor) {
    setOpenFor(item?.id ?? null);
    setReason('');
    setProblems({});
  }
  if (!item) return null;
  const x = ob.item(item.id);
  const quotations = ob.depositQuotations(x.id);
  const attempt = (fn: () => void, message: string) => {
    try {
      fn();
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      return setProblems(e.problems);
    }
    onChanged(message);
  };
  const title = x.oldNumber ? `Opening balance · invoice ${x.oldNumber}` : 'Opening balance';
  return (
    <Sheet visible title={title} onClose={onClose}>
      <Text style={[parts.body, local.strong, { color: c.fg }]}>{openingLine(x)}</Text>
      <Text style={[parts.small, { color: c.label }]}>
        {[`Dated ${longDate(x.date)}, your Start date`, x.jobTitle ? `Job: ${x.jobTitle}` : '', x.kind === 'owed' && x.note ? x.note : '']
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {x.status === 'cancelled' ? (
        <Text style={[parts.body, { color: c.fg }]}>{`Cancelled on ${longDate(x.cancelledOn!)}: ${x.cancelReason}`}</Text>
      ) : (
        <>
          {x.status === 'paid' ? <Text style={[parts.body, { color: c.fg }]}>✓ Paid</Text> : null}
          {x.status === 'used' ? (
            <Text style={[parts.body, { color: c.fg }]}>{`This Credit is the Deposit on ${x.depositOn ?? 'a Quotation'}.`}</Text>
          ) : null}
          {x.kind === 'owed' && x.status === 'open' && onRecordPayment ? (
            <Button primary label="Record Payment" onPress={onRecordPayment} />
          ) : null}
          {x.kind === 'credit' && x.status === 'open' ? (
            <View style={local.group}>
              <Text accessibilityRole="header" style={[local.heading, { color: c.label }]}>
                Use it as a Deposit
              </Text>
              {quotations.length > 0 ? (
                <List>
                  {quotations.map((q, i) => (
                    <Row
                      key={q.id}
                      first={i === 0}
                      title={`Make it the Deposit on ${q.number}`}
                      subtitle={[q.jobTitle, `Total ${formatUsd(q.total)}`].filter(Boolean).join(' · ')}
                      onPress={() => attempt(() => ob.makeDeposit(x.id, q.id), `${formatUsd(x.left)} is now the Deposit on ${q.number}.`)}
                    />
                  ))}
                </List>
              ) : (
                <Text style={[parts.small, { color: c.label }]}>
                  If you make the Quotation for this money again in Mhizha and it is Accepted, this Credit can become its Deposit here.
                </Text>
              )}
              {problems.quotation ? <ProblemLine text={problems.quotation} /> : null}
            </View>
          ) : null}
          {x.status === 'open' ? (
            <View style={local.group}>
              <TextField label="Reason to cancel" value={reason} onChange={setReason} error={problems.reason} />
              <Button danger label="Cancel this opening balance" onPress={() => attempt(() => ob.cancel(x.id, reason), 'Opening balance cancelled.')} />
              <Text style={[parts.small, { color: c.label }]}>If it was wrong, cancel it and add it again. A debt that will never be paid is written off instead.</Text>
            </View>
          ) : null}
          {problems.clock ? <ProblemLine text={problems.clock} /> : null}
        </>
      )}
    </Sheet>
  );
}

/** The 12 months before the Start date, a sales total for each; empty months stay blank. */
export function SalesBeforeStartForm({
  texts,
  onChange,
  problems,
}: {
  texts: Readonly<Record<string, string>>;
  onChange: (month: string, text: string) => void;
  problems: Readonly<Record<string, string>>;
}) {
  return (
    <View style={local.group}>
      {Object.keys(texts).map((month) => (
        <TextField
          key={month}
          label={`${monthName(month)} (US$)`}
          value={texts[month]!}
          onChange={(t) => onChange(month, t)}
          error={problems[month]}
          keyboardType="decimal-pad"
        />
      ))}
    </View>
  );
}

/** What the sales form starts with: what was entered, in dollars, or empty. */
export function salesTexts(db: ReturnType<typeof useDb>): Record<string, string> {
  return Object.fromEntries(salesBeforeStart(db).map((m) => [m.month, m.amount === null ? '' : (m.amount / 100).toFixed(2)]));
}

/** Saves the sales typed in. Returns the problems by month; empty when saved. */
export function saveSalesTexts(db: ReturnType<typeof useDb>, texts: Readonly<Record<string, string>>): Record<string, string> {
  const { totals, problems } = readMonthTotals(texts);
  if (Object.keys(problems).length) return problems;
  try {
    setSalesBeforeStart(db, totals);
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    return e.problems;
  }
  return {};
}

/** True when no month before the Start date has a sales total. */
export function salesBlank(db: ReturnType<typeof useDb>): boolean {
  return salesBeforeStart(db).every((m) => m.amount === null);
}

function ProblemLine({ text }: { text: string }) {
  const c = useColours();
  return <Text accessibilityLiveRegion="polite" style={[parts.small, local.strong, { color: c.bad }]}>{`! ${text}`}</Text>;
}

const local = StyleSheet.create({
  group: { gap: space.s3 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  strong: { fontWeight: '600' },
  heading: { fontSize: type.s, lineHeight: lineHeight(type.s), fontWeight: '600' },
});

/**
 * Every Opening balance item not Cancelled, by Customer, with Add opening
 * balance: the setup step and the Settings page.
 */
export function OpeningBalancesForm() {
  const c = useColours();
  const ob = useOpenings();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<OpeningItem | null>(null);
  const [note, setNote] = useState('');
  const items = ob.all();
  return (
    <View style={local.group}>
      {items.length > 0 ? (
        <OpeningList items={items} withCustomer onOpen={setOpen} />
      ) : (
        <Text style={[parts.body, { color: c.label }]}>None added.</Text>
      )}
      <Button label="Add opening balance" onPress={() => setAdding(true)} />
      <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.fg }]}>
        {note}
      </Text>
      <AddOpeningSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={(m) => {
          setAdding(false);
          setNote(`✓ ${m}`);
        }}
      />
      <OpeningItemSheet
        item={open}
        onClose={() => setOpen(null)}
        onChanged={(m) => {
          setOpen(null);
          setNote(`✓ ${m}`);
        }}
      />
    </View>
  );
}
