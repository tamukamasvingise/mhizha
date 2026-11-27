import { useReducer, useState, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  discountLabel,
  formatQuantity,
  formatUsd,
  parsePercent,
  parseQuantity,
  parseUsd,
  sumInWords,
  type Discount,
} from '../../core';
import { longDate } from '../../dates';
import { InputError } from '../../people';
import { useProblems, usePeople, type Nav } from '../../people/screens/common';
import { jobStatusWord } from '../../people/screens/JobScreen';
import { priceItems } from '../../prices/priceList';
import { useDb } from '../../shell/Records';
import { invoiceSteps, type InvoiceStep } from '../../shell/navigation';
import { todayAt } from '../../setup/dates';
import { Choice, TextField } from '../../ui/fields';
import { DateField, List, Row, Section, SmallButton } from '../../ui/forms';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { StepFoot, StepHead } from '../../ui/steps';
import { useColours } from '../../ui/theme';
import { lineHeight, size, space, type } from '../../ui/tokens';
import type { Draft, LineInput } from '..';
import { useDocuments } from './common';

// Making an Invoice with no Quotation, one question per screen: who, which
// Job, the lines, then check and issue. Each step is a sub screen on top of
// the one before, so Back (on screen or the phone's) goes a step back. The
// Draft is saved as the User goes; it has no number until it is issued.

const QUESTIONS: Record<InvoiceStep, string> = {
  who: 'Who is it for?',
  job: 'Which Job?',
  lines: 'What are you charging for?',
  check: 'Check and issue',
};

type Props = { step: InvoiceStep; id?: string; nav: Nav };

export function InvoiceStepScreen({ step, id, nav }: Props) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const d = useDocuments();
  const draft = id ? d.draft(id) : null;
  const n = invoiceSteps.indexOf(step) + 1;
  const goTo = (next: InvoiceStep, draftId: string) => nav.open({ screen: 'invoice-step', step: next, id: draftId });

  let body: ReactNode;
  let next: { label: string; onPress: () => void } | undefined;
  let lead: string | undefined;
  switch (step) {
    case 'who':
      lead = 'Pick the Customer. The Invoice is saved as a Draft as you go.';
      body = <WhoStep draft={draft} nav={nav} />;
      if (draft) next = { label: 'Next', onPress: () => goTo('job', draft.id) };
      break;
    case 'job':
      lead = 'The piece of work you are charging for.';
      body = <JobStep draft={draft!} onChosen={() => goTo('lines', draft!.id)} />;
      if (draft?.jobId) next = { label: 'Next', onPress: () => goTo('lines', draft.id) };
      break;
    case 'lines':
      lead = 'Add lines from your Price list or type them. Prices can be changed for this Invoice only.';
      body = <LinesStep draft={draft!} onChange={refresh} />;
      next = { label: 'Next', onPress: () => goTo('check', draft!.id) };
      break;
    case 'check':
      lead = 'Once issued, the Invoice gets its number and can no longer be changed.';
      body = <CheckStep draft={draft!} nav={nav} onChange={refresh} />;
      break;
  }

  return (
    <View style={styles.screen}>
      <SubTopBar title={draft ? 'Draft Invoice' : 'New Invoice'} onBack={nav.back} />
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
          <StepHead n={n} of={invoiceSteps.length} question={QUESTIONS[step]} lead={lead} />
          {body}
        </ScrollView>
        <StepFoot onBack={n > 1 ? nav.back : undefined} next={next} />
      </KeyboardAvoidingView>
    </View>
  );
}

function WhoStep({ draft, nav }: { draft: Draft | null; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const d = useDocuments();
  const [search, setSearch] = useState('');
  const all = p.customers();
  const shown = p.customers({ search });
  const choose = (customerId: string) => {
    if (draft) {
      d.setCustomer(draft.id, customerId);
      nav.open({ screen: 'invoice-step', step: 'job', id: draft.id });
    } else {
      const id = d.newInvoice(customerId);
      nav.replace({ screen: 'invoice-step', step: 'who', id });
      nav.open({ screen: 'invoice-step', step: 'job', id });
    }
  };
  if (all.length === 0)
    return (
      <View style={styles.group}>
        <Text style={[parts.body, { color: c.label }]}>No Customers yet. Add the Customer first, then make the Invoice from their screen.</Text>
        <Button label="Add a Customer" onPress={() => nav.replace({ screen: 'customer-form' })} />
      </View>
    );
  return (
    <View style={styles.group}>
      {all.length > 5 ? <TextField label="Find a Customer" hint="Part of a name, or a phone number" value={search} onChange={setSearch} /> : null}
      {shown.length > 0 ? (
        <List>
          {shown.map((x, i) => {
            const on = draft?.customerId === x.id;
            return (
              <Row
                key={x.id}
                first={i === 0}
                title={on ? `✓ ${x.name}` : x.name}
                subtitle={x.firstSite || undefined}
                label={`${x.name}${on ? ', chosen' : ''}`}
                onPress={() => choose(x.id)}
              />
            );
          })}
        </List>
      ) : (
        <Text style={[parts.body, { color: c.label }]}>No Customer matches. Check the spelling, or try a phone number.</Text>
      )}
    </View>
  );
}

function JobStep({ draft, onChosen }: { draft: Draft; onChosen: () => void }) {
  const c = useColours();
  const p = usePeople();
  const d = useDocuments();
  const [adding, setAdding] = useState(false);
  const customer = p.customer(draft.customerId);
  const jobs = p.jobs(draft.customerId);
  const choose = (jobId: string) => {
    d.setJob(draft.id, jobId);
    onChosen();
  };
  return (
    <View style={styles.group}>
      <Section title={`Jobs for ${customer.name}`} action={<SmallButton icon="plus" label="New Job" onPress={() => setAdding(true)} />}>
        {jobs.length > 0 ? (
          <List>
            {jobs.map((j, i) => {
              const on = draft.jobId === j.id;
              return (
                <Row
                  key={j.id}
                  first={i === 0}
                  title={on ? `✓ ${j.title}` : j.title}
                  subtitle={`${j.siteName} · ${jobStatusWord(j)}`}
                  label={`${j.title}, ${j.siteName}, ${jobStatusWord(j)}${on ? ', chosen' : ''}`}
                  onPress={() => choose(j.id)}
                />
              );
            })}
          </List>
        ) : (
          <Text style={[parts.body, { color: c.label }]}>No Jobs yet for {customer.name}. Tap New Job to add the work this Invoice is for.</Text>
        )}
      </Section>
      <NewJobSheet visible={adding} customerId={draft.customerId} onClose={() => setAdding(false)} onAdded={(jobId) => (setAdding(false), choose(jobId))} />
    </View>
  );
}

function NewJobSheet({
  visible,
  customerId,
  onClose,
  onAdded,
}: {
  visible: boolean;
  customerId: string;
  onClose: () => void;
  onAdded: (jobId: string) => void;
}) {
  const p = usePeople();
  const { problems, attempt } = useProblems();
  const sites = p.sites(customerId);
  const [title, setTitle] = useState('');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  return (
    <Sheet visible={visible} title="New Job" onClose={onClose}>
      <TextField label="What is the work?" hint='For example "Kitchen rewiring"' value={title} onChange={setTitle} error={problems.title} autoFocus />
      {sites.length > 1 ? (
        <Choice label="At which Site?" options={sites.map((s) => ({ value: s.id, label: s.name }))} value={siteId} onChange={setSiteId} error={problems.siteId} />
      ) : null}
      <Button primary label="Add Job" onPress={() => attempt(() => onAdded(p.addJob(customerId, { title, siteId })))} />
    </Sheet>
  );
}

type Editing = { index: number | null; line: LineInput } | null;

function LinesStep({ draft, onChange }: { draft: Draft; onChange: () => void }) {
  const c = useColours();
  const db = useDb();
  const d = useDocuments();
  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState(false);
  const items = priceItems(db);
  const save = (lines: LineInput[]) => {
    d.setLines(draft.id, lines);
    onChange();
  };
  return (
    <View style={styles.group}>
      {draft.lines.length > 0 ? (
        <List>
          {draft.lines.map((l, i) => {
            const qty = `${formatQuantity(l.quantity)}${l.unit ? ` ${l.unit}` : ''} × ${formatUsd(l.unitPrice)}`;
            return (
              <Row
                key={l.id}
                first={i === 0}
                title={l.description}
                subtitle={qty}
                label={`${l.description}, ${qty}, ${formatUsd(l.amount)}. Tap to change it.`}
                right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(l.amount)}</Text>}
                onPress={() => setEditing({ index: i, line: l })}
              />
            );
          })}
        </List>
      ) : (
        <Text style={[parts.body, { color: c.label }]}>No lines yet. Add what you are charging for: labour, materials, call-out.</Text>
      )}
      <View style={styles.buttons}>
        <SmallButton icon="plus" label="Add from Price list" onPress={() => setPicking(true)} />
        <SmallButton icon="plus" label="Type a line" onPress={() => setEditing({ index: null, line: blankLine })} />
      </View>
      <DiscountField draft={draft} onChange={onChange} />
      <Totals draft={draft} />

      <Sheet visible={picking} title="Add from Price list" onClose={() => setPicking(false)}>
        {items.length > 0 ? (
          <List>
            {items.map((it, i) => (
              <Row
                key={it.id}
                first={i === 0}
                title={it.name}
                subtitle={`${formatUsd(it.unitPrice)}${it.unit ? ` per ${it.unit}` : ''}`}
                onPress={() => {
                  setPicking(false);
                  setEditing({ index: null, line: d.lineFromPriceItem(it) });
                }}
              />
            ))}
          </List>
        ) : (
          <Text style={[parts.body, { color: c.label }]}>
            Your Price list is empty. Add items in Settings, Price list, or type a line here.
          </Text>
        )}
      </Sheet>
      <LineSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(line) => {
          const lines: LineInput[] = [...draft.lines];
          if (editing?.index == null) lines.push(line);
          else lines[editing.index] = line;
          save(lines);
          setEditing(null);
        }}
        onRemove={() => {
          save(draft.lines.filter((_, i) => i !== editing?.index));
          setEditing(null);
        }}
      />
    </View>
  );
}

const blankLine: LineInput = { priceListItemId: null, description: '', unit: '', quantity: 1000, unitPrice: 0 };

function LineSheet({
  editing,
  onClose,
  onSave,
  onRemove,
}: {
  editing: Editing;
  onClose: () => void;
  onSave: (line: LineInput) => void;
  onRemove: () => void;
}) {
  const [openFor, setOpenFor] = useState<Editing>(null);
  const [f, setF] = useState({ description: '', unit: '', quantity: '', unitPrice: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (editing !== openFor) {
    setOpenFor(editing);
    if (editing) {
      const l = editing.line;
      setF({
        description: l.description,
        unit: l.unit,
        quantity: formatQuantity(l.quantity),
        unitPrice: l.description === '' && l.unitPrice === 0 ? '' : (l.unitPrice / 100).toFixed(2),
      });
    }
    setErrors({});
  }
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const save = () => {
    const e: Record<string, string> = {};
    if (f.description.trim() === '') e.description = 'Say what this line is for.';
    const q = parseQuantity(f.quantity);
    if (!q.ok) e.quantity = q.message;
    const price = parseUsd(f.unitPrice);
    if (!price.ok) e.unitPrice = price.message;
    setErrors(e);
    if (!q.ok || !price.ok || e.description) {
      AccessibilityInfo.announceForAccessibility(`Not saved. ${Object.values(e).join(' ')}`);
      return;
    }
    onSave({ ...editing!.line, description: f.description, unit: f.unit, quantity: q.thousandths, unitPrice: price.cents });
  };
  const isNew = editing?.index == null;
  return (
    <Sheet visible={editing !== null} title={isNew ? 'Add a line' : 'Change the line'} onClose={onClose}>
      <TextField label="Description" value={f.description} onChange={set('description')} error={errors.description} autoFocus={f.description === ''} />
      <TextField label="Quantity" value={f.quantity} onChange={set('quantity')} error={errors.quantity} keyboardType="decimal-pad" />
      <TextField label="Unit (optional)" hint='For example "day", "m" or "each"' value={f.unit} onChange={set('unit')} />
      <TextField label="Unit price (US$)" hint="Changes this Invoice only, not the Price list" value={f.unitPrice} onChange={set('unitPrice')} error={errors.unitPrice} keyboardType="decimal-pad" />
      <Button primary label={isNew ? 'Add line' : 'Save line'} onPress={save} />
      {!isNew ? <Button label="Remove line" onPress={onRemove} /> : null}
    </Sheet>
  );
}

type DiscountKind = 'none' | 'amount' | 'percent';

function DiscountField({ draft, onChange }: { draft: Draft; onChange: () => void }) {
  const c = useColours();
  const d = useDocuments();
  const saved = draft.discount;
  const [kind, setKind] = useState<DiscountKind>(saved?.kind ?? 'none');
  const [text, setText] = useState(
    saved === null ? '' : saved.kind === 'amount' ? (saved.cents / 100).toFixed(2) : String(saved.tenths / 10),
  );
  const [error, setError] = useState<string | undefined>(draft.totals.error);

  const apply = (k: DiscountKind, t: string) => {
    let discount: Discount | null = null;
    if (k !== 'none' && t.trim() !== '') {
      if (k === 'percent') {
        const pc = parsePercent(t);
        if (!pc.ok) return setError(pc.message);
        discount = { kind: 'percent', tenths: pc.tenths };
      } else {
        const a = parseUsd(t);
        if (!a.ok) return setError(a.message);
        discount = { kind: 'amount', cents: a.cents };
      }
    }
    try {
      d.setDiscount(draft.id, discount);
      setError(undefined);
      onChange();
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setError(e.problems.discount);
    }
  };

  const percentText =
    kind === 'percent' && !error && draft.discount?.kind === 'percent'
      ? `${draft.discount.tenths / 10}% = ${formatUsd(draft.totals.discount)}`
      : null;
  return (
    <View style={styles.group}>
      <Choice<DiscountKind>
        label="Discount"
        options={[
          { value: 'none', label: 'None' },
          { value: 'amount', label: 'US$' },
          { value: 'percent', label: '%' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          apply(k, k === 'none' ? '' : text);
        }}
      />
      {kind !== 'none' ? (
        <TextField
          label={kind === 'percent' ? 'Discount in %' : 'Discount in US$'}
          hint={kind === 'percent' ? 'From 0 to 99.9' : 'Never more than the Subtotal'}
          value={text}
          onChange={(t) => {
            setText(t);
            apply(kind, t);
          }}
          error={error}
          keyboardType="decimal-pad"
        />
      ) : null}
      {percentText ? (
        <Text accessibilityLiveRegion="polite" style={[parts.body, { color: c.fg }]}>
          {percentText}
        </Text>
      ) : null}
    </View>
  );
}

/** Subtotal, Discount and Total, amounts at the right. */
function Totals({ draft, words }: { draft: Draft; words?: boolean }) {
  const c = useColours();
  const t = draft.totals;
  const rows: [string, string][] = [['Subtotal', formatUsd(t.subtotal)]];
  if (t.discount > 0 && draft.discount) rows.push([discountLabel(draft.discount), `−${formatUsd(t.discount)}`]);
  return (
    <View style={styles.totals} accessible accessibilityLabel={[...rows.map((r) => r.join(' ')), `Total ${formatUsd(t.total)}`].join(', ')}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.totalRow}>
          <Text style={[parts.body, styles.grow, { color: c.label }]}>{k}</Text>
          <Text style={[styles.amount, { color: c.fg }]}>{v}</Text>
        </View>
      ))}
      <View style={[styles.totalRow, styles.totalLine, { borderTopColor: c.line }]}>
        <Text style={[styles.totalText, styles.grow, { color: c.fg }]}>Total</Text>
        <Text style={[styles.totalText, styles.amount, { color: c.fg }]}>{formatUsd(t.total)}</Text>
      </View>
      {words && t.total > 0 ? <Text style={[parts.small, { color: c.label }]}>{sumInWords(t.total)}</Text> : null}
    </View>
  );
}

function CheckStep({ draft, nav, onChange }: { draft: Draft; nav: Nav; onChange: () => void }) {
  const c = useColours();
  const p = usePeople();
  const d = useDocuments();
  const [sheet, setSheet] = useState<'issue' | 'delete' | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [orderNo, setOrderNo] = useState(draft.orderNo);
  const today = todayAt(Date.now());
  const customer = p.customer(draft.customerId);
  const job = draft.jobId ? p.job(draft.jobId) : null;
  const number = d.nextNumber('INV');

  const details = (next: { dueDate?: string | null; orderNo?: string }) => {
    d.setDetails(draft.id, { dueDate: draft.dueDate, orderNo, ...next });
    onChange();
  };
  const issue = () => {
    try {
      d.issue(draft.id);
      nav.leave(draft.id, { screen: 'document', id: draft.id });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setSheet(null);
      setProblems(e.problems);
      AccessibilityInfo.announceForAccessibility(`Not issued. ${e.message}`);
    }
  };

  return (
    <View style={styles.group}>
      <List>
        <Row first title={customer.name} subtitle="Bill to" label={`Bill to ${customer.name}`} onPress={() => nav.open({ screen: 'invoice-step', step: 'who', id: draft.id })} />
        <Row
          title={job ? job.title : 'No Job chosen'}
          subtitle={job ? `${job.siteName} · Job` : 'Pick the Job this Invoice is for'}
          onPress={() => nav.open({ screen: 'invoice-step', step: 'job', id: draft.id })}
        />
      </List>
      {problems.job ? <ProblemText text={problems.job} /> : null}

      <Section title="Lines" action={<SmallButton label="Change lines" onPress={() => nav.open({ screen: 'invoice-step', step: 'lines', id: draft.id })} />}>
        {draft.lines.length > 0 ? (
          <List>
            {draft.lines.map((l, i) => (
              <Row
                key={l.id}
                first={i === 0}
                title={l.description}
                subtitle={`${formatQuantity(l.quantity)}${l.unit ? ` ${l.unit}` : ''} × ${formatUsd(l.unitPrice)}`}
                right={<Text style={[styles.amount, { color: c.fg }]}>{formatUsd(l.amount)}</Text>}
              />
            ))}
          </List>
        ) : (
          <Text style={[parts.body, { color: c.label }]}>No lines yet. Tap Change lines to add what you are charging for.</Text>
        )}
        {problems.lines ? <ProblemText text={problems.lines} /> : null}
      </Section>
      <Totals draft={draft} words />
      {problems.total || problems.discount ? <ProblemText text={(problems.total ?? problems.discount)!} /> : null}

      <DateField
        label="Due date"
        hint="The day the Customer should pay by"
        value={draft.dueDate ?? ''}
        empty="The issue date"
        min={today}
        onChange={(dueDate) => details({ dueDate })}
        error={problems.dueDate}
      />
      {draft.dueDate ? (
        <View style={styles.buttons}>
          <SmallButton label="Due on the issue date" onPress={() => details({ dueDate: null })} />
        </View>
      ) : null}
      <TextField
        label="Order No. (optional)"
        hint="The Customer's own order number, printed on the Invoice"
        value={orderNo}
        onChange={(t) => {
          setOrderNo(t);
          d.setDetails(draft.id, { dueDate: draft.dueDate, orderNo: t });
        }}
      />
      {problems.clock ? <ProblemText text={problems.clock} /> : null}
      {problems.business ? <ProblemText text={problems.business} /> : null}

      <Button primary label={`Issue ${number}`} onPress={() => setSheet('issue')} />
      <Button label="Preview the Invoice" onPress={() => nav.open({ screen: 'preview', id: draft.id })} />
      <Button label="Delete Draft" onPress={() => setSheet('delete')} />

      <Sheet visible={sheet === 'issue'} title={`Issue ${number}?`} onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>
          {`${customer.name} will owe you ${formatUsd(draft.totals.total)}. The Invoice is dated today, ${longDate(today)}, and can no longer be changed or deleted. Its PDF is made once, ready to share.`}
        </Text>
        <Button primary label={`Issue ${number}`} onPress={issue} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} title="Delete this Draft?" onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>It has no number yet, so nothing else changes.</Text>
        <Button
          primary
          label="Delete Draft"
          onPress={() => {
            d.deleteDraft(draft.id);
            nav.leave(draft.id);
          }}
        />
      </Sheet>
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
  group: { gap: space.s3 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  totals: { gap: space.s1 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3 },
  totalLine: { borderTopWidth: size.hairline, paddingTop: space.s2, marginTop: space.s1 },
  totalText: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '700' },
  grow: { flex: 1 },
  problem: { fontWeight: '700' },
});
