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
import { addDays, todayAt } from '../../setup/dates';
import { Choice, TextField } from '../../ui/fields';
import { DateField, List, Row, Section, SmallButton } from '../../ui/forms';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { StepFoot, StepHead } from '../../ui/steps';
import { useColours } from '../../ui/theme';
import { lineHeight, radius, size, space, type } from '../../ui/tokens';
import { VALID_DAYS, type Documents, type Draft, type LineInput } from '..';
import { useDocuments } from './common';

// Making a Quotation or an Invoice, one question per screen: who, which Job,
// the lines, then check and issue. Each step is a sub screen on top of the one
// before, so Back (on screen or the phone's) goes a step back. The Draft is
// saved as the User goes; it has no number until it is issued. A Revision and
// an Invoice from a Quotation keep their Quotation's Customer and Job.

const QUESTIONS: Record<'QUO' | 'INV', Record<InvoiceStep, string>> = {
  QUO: { who: 'Who is it for?', job: 'Which Job?', lines: 'What are you quoting for?', check: 'Check and issue' },
  INV: { who: 'Who is it for?', job: 'Which Job?', lines: 'What are you charging for?', check: 'Check and issue' },
};

type Kind = 'QUO' | 'INV';
const NAME: Record<Kind, string> = { QUO: 'Quotation', INV: 'Invoice' };

type Props = { step: InvoiceStep; id?: string; type?: Kind; nav: Nav };

/** "Draft Quotation", "Revision 2 of QUO-0012", "New Invoice". */
function titleFor(d: Documents, draft: Draft | null, kind: Kind): string {
  if (!draft) return `New ${NAME[kind]}`;
  if (draft.revisesId) {
    const [base, rev] = d.numberFor(draft.id).split(' Rev ');
    return `Revision ${rev} of ${base}`;
  }
  return `Draft ${NAME[kind]}`;
}

export function InvoiceStepScreen({ step, id, type, nav }: Props) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const d = useDocuments();
  const p = usePeople();
  const draft = id ? d.draft(id) : null;
  const kind: Kind = draft ? (draft.type as Kind) : (type ?? 'INV');
  const name = NAME[kind];
  const fixed = draft !== null && (draft.revisesId !== null || draft.quotationId !== null);
  const n = invoiceSteps.indexOf(step) + 1;
  const goTo = (next: InvoiceStep, draftId: string) => nav.open({ screen: 'invoice-step', step: next, id: draftId });

  let body: ReactNode;
  let next: { label: string; onPress: () => void } | undefined;
  let lead: string | undefined;
  switch (step) {
    case 'who':
      lead = fixed ? `It is for the Customer of its Quotation.` : `Pick the Customer. The ${name} is saved as a Draft as you go.`;
      body = fixed ? <FixedChoice title={p.customer(draft!.customerId).name} /> : <WhoStep draft={draft} kind={kind} nav={nav} />;
      if (draft) next = { label: 'Next', onPress: () => goTo('job', draft.id) };
      break;
    case 'job':
      lead = fixed ? 'It is for the Job of its Quotation.' : kind === 'QUO' ? 'The piece of work you are quoting for.' : 'The piece of work you are charging for.';
      body = fixed ? <FixedJob jobId={draft!.jobId!} /> : <JobStep draft={draft!} onChosen={() => goTo('lines', draft!.id)} />;
      if (draft?.jobId) next = { label: 'Next', onPress: () => goTo('lines', draft.id) };
      break;
    case 'lines':
      lead = draft!.quotationId
        ? 'Copied from the Quotation. Change the lines if the work changed, or keep only the part you are invoicing now.'
        : `Add lines from your Price list or type them. Prices can be changed for this ${name} only.`;
      body = <LinesStep draft={draft!} onChange={refresh} />;
      next = { label: 'Next', onPress: () => goTo('check', draft!.id) };
      break;
    case 'check':
      lead =
        kind === 'QUO'
          ? 'Once issued, the Quotation gets its number and can no longer be changed. To change it later, make a Revision.'
          : 'Once issued, the Invoice gets its number and can no longer be changed.';
      body = <CheckStep draft={draft!} nav={nav} onChange={refresh} />;
      break;
  }

  return (
    <View style={styles.screen}>
      <SubTopBar title={titleFor(d, draft, kind)} onBack={nav.back} />
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
          <StepHead n={n} of={invoiceSteps.length} question={QUESTIONS[kind][step]} lead={lead} />
          {body}
        </ScrollView>
        <StepFoot onBack={n > 1 ? nav.back : undefined} next={next} />
      </KeyboardAvoidingView>
    </View>
  );
}

/** A choice made already, shown with a tick, for a Draft whose Quotation decides it. */
function FixedChoice({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <List>
      <Row first title={`✓ ${title}`} subtitle={subtitle} label={`${title}${subtitle ? `, ${subtitle}` : ''}, chosen`} />
    </List>
  );
}

function FixedJob({ jobId }: { jobId: string }) {
  const j = usePeople().job(jobId);
  return <FixedChoice title={j.title} subtitle={`${j.siteName} · ${jobStatusWord(j)}`} />;
}

function WhoStep({ draft, kind, nav }: { draft: Draft | null; kind: Kind; nav: Nav }) {
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
      const id = kind === 'QUO' ? d.newQuotation(customerId) : d.newInvoice(customerId);
      nav.replace({ screen: 'invoice-step', step: 'who', id });
      nav.open({ screen: 'invoice-step', step: 'job', id });
    }
  };
  if (all.length === 0)
    return (
      <View style={styles.group}>
        <Text style={[parts.body, { color: c.label }]}>{`No Customers yet. Add the Customer first, then make the ${NAME[kind]}.`}</Text>
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
          <Text style={[parts.body, { color: c.label }]}>
            {`No Jobs yet for ${customer.name}. Tap New Job to add the work this ${NAME[draft.type as Kind]} is for.`}
          </Text>
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
        <Text style={[parts.body, { color: c.label }]}>
          {`No lines yet. Add what you are ${draft.type === 'QUO' ? 'quoting' : 'charging'} for: labour, materials, call-out.`}
        </Text>
      )}
      <View style={styles.buttons}>
        <SmallButton icon="plus" label="Add from Price list" onPress={() => setPicking(true)} />
        <SmallButton icon="plus" label="Type a line" onPress={() => setEditing({ index: null, line: blankLine })} />
      </View>
      {draft.quotationId ? <ShareField draft={draft} onChange={onChange} /> : <DiscountField draft={draft} onChange={onChange} />}
      <Totals draft={draft} />
      <OverNotice draft={draft} />

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
      <TextField label="Unit price (US$)" hint="Changes this Document only, not the Price list" value={f.unitPrice} onChange={set('unitPrice')} error={errors.unitPrice} keyboardType="decimal-pad" />
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

/** An Invoice from a Quotation takes a share of its Discount, filled in by the app and changeable, in US$. */
function ShareField({ draft, onChange }: { draft: Draft; onChange: () => void }) {
  const c = useColours();
  const d = useDocuments();
  const from = d.fromQuotation(draft.id)!;
  const saved = draft.discount?.kind === 'amount' ? draft.discount.cents : 0;
  const [text, setText] = useState(saved > 0 ? (saved / 100).toFixed(2) : '');
  const [shownFor, setShownFor] = useState(saved);
  const [error, setError] = useState<string | undefined>();
  if (from.discount === 0) return null;
  // The app moves the share when the lines change; show the new one.
  if (saved !== shownFor && !error) {
    setShownFor(saved);
    setText(saved > 0 ? (saved / 100).toFixed(2) : '');
  }
  const apply = (t: string) => {
    setText(t);
    const a = t.trim() === '' ? { ok: true as const, cents: 0 } : parseUsd(t);
    if (!a.ok) return setError(a.message);
    try {
      d.setDiscount(draft.id, { kind: 'amount', cents: a.cents });
      setError(undefined);
      setShownFor(a.cents);
      onChange();
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setError(e.problems.discount);
    }
  };
  return (
    <View style={styles.group}>
      <TextField
        label="Discount (US$)"
        hint={`This Invoice's share of the ${formatUsd(from.discount)} Discount on ${from.number}. ${formatUsd(from.discountLeft)} of it is left.`}
        value={text}
        onChange={apply}
        error={error}
        keyboardType="decimal-pad"
      />
      {from.suggestedShare !== saved ? (
        <View style={styles.buttons}>
          <SmallButton label={`Use the share, ${formatUsd(from.suggestedShare)}`} onPress={() => apply((from.suggestedShare / 100).toFixed(2))} />
        </View>
      ) : null}
      <Text style={[parts.small, { color: c.label }]}>The share is worked out from this Invoice's Subtotal; the last Invoice takes what is left.</Text>
    </View>
  );
}

/** For an Invoice from a Quotation: a notice when it and the earlier Invoices come to more than the Quotation. */
function OverNotice({ draft }: { draft: Draft }) {
  const c = useColours();
  const from = useDocuments().fromQuotation(draft.id);
  if (!from) return null;
  return (
    <View accessible style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[parts.body, styles.strong, { color: c.fg }]}>{`From ${from.number}, ${formatUsd(from.total)}`}</Text>
      <Text style={[parts.small, { color: c.label }]}>
        {from.invoicedBefore > 0
          ? `Invoiced before: ${formatUsd(from.invoicedBefore)}. Remaining: ${formatUsd(Math.max(0, from.total - from.invoicedBefore))}.`
          : 'Nothing invoiced from it yet.'}
      </Text>
      {from.over > 0 ? (
        <Text accessibilityLiveRegion="polite" style={[parts.small, styles.strong, { color: c.fg }]}>
          {`This Invoice and earlier ones come to ${formatUsd(from.over)} more than ${from.number}. You can still issue it.`}
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
  const [deposit, setDeposit] = useState(draft.depositAsked ? (draft.depositAsked / 100).toFixed(2) : '');
  const [leadTime, setLeadTime] = useState(draft.leadTime);
  const today = todayAt(Date.now());
  const customer = p.customer(draft.customerId);
  const job = draft.jobId ? p.job(draft.jobId) : null;
  const quotation = draft.type === 'QUO';
  const name = NAME[draft.type as Kind];
  const number = d.numberFor(draft.id);
  const fixed = draft.revisesId !== null || draft.quotationId !== null;
  const validUntil = draft.validUntil ?? addDays(today, VALID_DAYS);

  const terms = (next: { validUntil?: string | null; deposit?: string; leadTime?: string }) => {
    const t = { validUntil: draft.validUntil, deposit, leadTime, ...next };
    const cents = t.deposit.trim() === '' ? null : parseUsd(t.deposit);
    if (cents !== null && !cents.ok) return setProblems({ ...problems, depositAsked: cents.message });
    try {
      d.setTerms(draft.id, { validUntil: t.validUntil, depositAsked: cents === null ? null : cents.cents, leadTime: t.leadTime });
      const { depositAsked: _d, validUntil: _v, ...rest } = problems;
      setProblems(rest);
      onChange();
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      setProblems({ ...problems, ...e.problems });
    }
  };

  const details = (next: { dueDate?: string | null; orderNo?: string }) => {
    d.setDetails(draft.id, { dueDate: draft.dueDate, orderNo, ...next });
    onChange();
  };
  const issue = () => {
    try {
      d.issue(draft.id);
      // A Revision or an Invoice from a Quotation opened over the Quotation's screen: show the new Document in its place.
      if (draft.revisesId) nav.leave(draft.id);
      if (draft.revisesId) nav.replace({ screen: 'document', id: draft.id });
      else nav.leave(draft.id, { screen: 'document', id: draft.id });
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
        <Row
          first
          title={customer.name}
          subtitle={quotation ? 'Quotation for' : 'Bill to'}
          label={`${quotation ? 'Quotation for' : 'Bill to'} ${customer.name}`}
          onPress={fixed ? undefined : () => nav.open({ screen: 'invoice-step', step: 'who', id: draft.id })}
        />
        <Row
          title={job ? job.title : 'No Job chosen'}
          subtitle={job ? `${job.siteName} · Job` : `Pick the Job this ${name} is for`}
          onPress={fixed ? undefined : () => nav.open({ screen: 'invoice-step', step: 'job', id: draft.id })}
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
          <Text style={[parts.body, { color: c.label }]}>{`No lines yet. Tap Change lines to add what you are ${quotation ? 'quoting' : 'charging'} for.`}</Text>
        )}
        {problems.lines ? <ProblemText text={problems.lines} /> : null}
      </Section>
      <Totals draft={draft} words />
      {problems.total || problems.discount ? <ProblemText text={(problems.total ?? problems.discount)!} /> : null}
      <OverNotice draft={draft} />
      {problems.quotation ? <ProblemText text={problems.quotation} /> : null}

      {quotation ? (
        <>
          <DateField
            label="Valid until"
            hint="The last day the prices hold"
            value={draft.validUntil ?? ''}
            empty={`30 days after issue, ${longDate(validUntil)}`}
            min={today}
            onChange={(v) => terms({ validUntil: v })}
            error={problems.validUntil}
          />
          {draft.validUntil ? (
            <View style={styles.buttons}>
              <SmallButton label="Valid for 30 days" onPress={() => terms({ validUntil: null })} />
            </View>
          ) : null}
          <TextField
            label="Deposit asked (US$, optional)"
            hint="Printed in the Terms, for example half the Total"
            value={deposit}
            onChange={(t) => {
              setDeposit(t);
              terms({ deposit: t });
            }}
            error={problems.depositAsked}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Lead time (optional)"
            hint='For example "5 working days after the Deposit"'
            value={leadTime}
            onChange={(t) => {
              setLeadTime(t);
              terms({ leadTime: t });
            }}
          />
        </>
      ) : (
        <>
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
        </>
      )}
      {problems.clock ? <ProblemText text={problems.clock} /> : null}
      {problems.business ? <ProblemText text={problems.business} /> : null}

      <Button primary label={`Issue ${number}`} onPress={() => setSheet('issue')} />
      <Button label={`Preview the ${name}`} onPress={() => nav.open({ screen: 'preview', id: draft.id })} />
      <Button label="Delete Draft" onPress={() => setSheet('delete')} />

      <Sheet visible={sheet === 'issue'} title={`Issue ${number}?`} onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>
          {quotation
            ? `${formatUsd(draft.totals.total)} for ${customer.name}, dated today, ${longDate(today)}, valid until ${longDate(validUntil)}. Nobody owes anything until you invoice it. It can no longer be changed or deleted; its PDF is made once, ready to share.`
            : `${customer.name} will owe you ${formatUsd(draft.totals.total)}. The Invoice is dated today, ${longDate(today)}, and can no longer be changed or deleted. Its PDF is made once, ready to share.`}
        </Text>
        {draft.revisesId ? (
          <Text style={[parts.body, { color: c.fg }]}>{`The older version becomes Superseded. ${number} must be accepted again.`}</Text>
        ) : null}
        <Button primary label={`Issue ${number}`} onPress={issue} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} title="Delete this Draft?" onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>
          {draft.revisesId ? 'The Quotation stays as it is.' : 'It has no number yet, so nothing else changes.'}
        </Text>
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
  strong: { fontWeight: '600' },
  notice: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s1 },
});
