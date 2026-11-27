import { useReducer, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { longDate, shortDate, today } from '../../dates';
import { DocumentList, useDocuments } from '../../documents/screens/common';
import { appliedTo } from '../../payments';
import { usePayments } from '../../payments/screens/PaymentScreen';
import { useDb } from '../../shell/Records';
import { Toggle } from '../../ui/fields';
import { DateField, Section, SmallButton, useToast } from '../../ui/forms';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, radius, size, space, type } from '../../ui/tokens';
import type { Job } from '..';
import { styles, useProblems, usePeople, type Nav } from './common';

// One Job: its Customer and Site, Open, Done or Dropped, set by hand. Marking
// it Done asks for the date work finished: today, or an earlier day. Closing
// it (Done or Dropped) with money owing or an unused Deposit warns, and
// offers to move the Deposit to Credit.

/** Open, "Done 26 Nov 2026" or Dropped, plus "archived". */
export function jobStatusWord(j: Job): string {
  const word = j.status === 'open' ? 'Open' : j.status === 'dropped' ? 'Dropped' : `Done ${shortDate(j.finishedOn)}`;
  return j.archived ? `${word}, archived` : word;
}

export function JobScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const d = useDocuments();
  const toast = useToast();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [sheet, setSheet] = useState<'done' | 'drop' | null>(null);
  const [moveDeposit, setMoveDeposit] = useState(false);
  const pay = usePayments();
  const closing = useClosing(id);
  /** Moves the Job's unused Deposits to Credit when the User chose to. */
  const moveIfChosen = () => {
    if (!moveDeposit) return '';
    const moved = closing.deposits.reduce((n, x) => n + pay.moveToCredit(x.quotationId), 0);
    setMoveDeposit(false);
    return moved > 0 ? ` ${formatUsd(moved)} Deposit moved to Credit.` : '';
  };
  const j = p.job(id);
  const customer = p.customer(j.customerId);
  const docs = d.list({ jobId: id });
  const newInvoice = () => {
    const draftId = d.newInvoice(j.customerId);
    d.setJob(draftId, id);
    nav.open({ screen: 'invoice-step', step: 'lines', id: draftId });
  };

  const reopen = () => {
    p.reopen(id);
    refresh();
    toast.show('The Job is open again.');
  };
  const archive = (on: boolean) => {
    if (on) p.archiveJob(id);
    else p.unarchiveJob(id);
    refresh();
    toast.show(on ? 'Job archived. It is hidden from lists; nothing is deleted.' : 'The Job is back in the list.');
  };

  return (
    <View style={styles.screen}>
      <SubTopBar title={j.title} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={local.head}>
          <Text style={[parts.small, { color: c.label }]}>
            {customer.name} · {j.siteName}
          </Text>
          <Text accessibilityRole="header" style={[local.title, { color: c.fg }]}>
            {j.title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[parts.body, local.status, { color: c.fg }]}>
            {j.status === 'done' ? `✓ Done. Work finished ${longDate(j.finishedOn)}.` : j.status === 'dropped' ? 'Dropped.' : 'Open.'}
            {j.archived ? ' Archived.' : ''}
          </Text>
        </View>

        {j.status === 'open' ? (
          <View style={styles.group}>
            <Button primary label="Mark Job Done" onPress={() => setSheet('done')} />
            <Button label="Mark Job Dropped" onPress={() => setSheet('drop')} />
          </View>
        ) : (
          <Button label="Open the Job again" onPress={reopen} />
        )}

        <Section
          title="Documents for this Job"
          action={j.archived ? null : <SmallButton icon="plus" label="New Invoice" onPress={newInvoice} />}
        >
          {docs.length > 0 ? (
            <DocumentList items={docs} nav={nav} showCustomer={false} />
          ) : (
            <Text style={[parts.body, { color: c.label }]}>None yet. Quotations and Invoices for this Job show here.</Text>
          )}
        </Section>

        <View style={styles.group}>
          <Button label="Change Job" onPress={() => nav.open({ screen: 'job-form', customerId: j.customerId, id })} />
          <Button label={j.archived ? 'Bring back from the archive' : 'Archive Job'} onPress={() => archive(!j.archived)} />
        </View>
      </ScrollView>
      <DoneSheet
        job={j}
        visible={sheet === 'done'}
        onClose={() => setSheet(null)}
        notice={<ClosingNotice closing={closing} move={moveDeposit} onMove={setMoveDeposit} />}
        onDone={(date) => {
          const moved = moveIfChosen();
          setSheet(null);
          refresh();
          toast.show(`Marked Done. Work finished ${longDate(date)}.${moved}`);
        }}
      />
      <Sheet visible={sheet === 'drop'} title={`Drop ${j.title}?`} onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>The Job stays in your records, marked Dropped. You can open it again later.</Text>
        <ClosingNotice closing={closing} move={moveDeposit} onMove={setMoveDeposit} />
        <Button
          primary
          label="Mark Dropped"
          onPress={() => {
            p.markDropped(id);
            const moved = moveIfChosen();
            setSheet(null);
            refresh();
            toast.show(`Job marked Dropped.${moved}`);
          }}
        />
      </Sheet>
      {toast.view}
    </View>
  );
}

type Closing = { owed: number; deposits: { quotationId: string; number: string; held: number }[] };

/** What closing the Job leaves open: money owing on its Invoices, and unused Deposits on its Quotations. */
function useClosing(jobId: string): Closing {
  const db = useDb();
  const d = useDocuments();
  const pay = usePayments();
  const owed = d
    .list({ jobId, filter: 'invoices' })
    .filter((x) => !x.draft)
    .reduce((n, x) => n + Math.max(0, x.total - appliedTo(db, x.id)), 0);
  return { owed, deposits: pay.depositsOnJob(jobId) };
}

/** Warns before a Job is closed with money owing or an unused Deposit, and offers to move the Deposit to Credit. */
function ClosingNotice({ closing, move, onMove }: { closing: Closing; move: boolean; onMove: (on: boolean) => void }) {
  const c = useColours();
  const held = closing.deposits.reduce((n, x) => n + x.held, 0);
  if (closing.owed === 0 && held === 0) return null;
  return (
    <>
      <View accessible style={[local.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
        {closing.owed > 0 ? (
          <Text style={[parts.body, local.status, { color: c.fg }]}>{`${formatUsd(closing.owed)} is still owed on this Job's Invoices.`}</Text>
        ) : null}
        {held > 0 ? (
          <Text style={[parts.body, local.status, { color: c.fg }]}>
            {`An unused Deposit of ${formatUsd(held)} is held on ${closing.deposits.map((x) => x.number).join(', ')}.`}
          </Text>
        ) : null}
        <Text style={[parts.small, { color: c.label }]}>
          {held > 0
            ? 'Keep it for an Invoice from the Quotation, or move it to Credit for the Customer.'
            : 'Closing the Job changes no Invoice; the money stays owed.'}
        </Text>
      </View>
      {held > 0 ? (
        <Toggle label="Move the Deposit to Credit" hint={`${formatUsd(held)} becomes Credit held for the Customer`} value={move} onChange={onMove} />
      ) : null}
    </>
  );
}

function DoneSheet({
  job,
  visible,
  notice,
  onClose,
  onDone,
}: {
  job: Job;
  visible: boolean;
  notice: ReactNode;
  onClose: () => void;
  onDone: (date: string) => void;
}) {
  const p = usePeople();
  const { problems, attempt } = useProblems();
  const [date, setDate] = useState(today);
  return (
    <Sheet visible={visible} title={`Mark ${job.title} Done`} onClose={onClose}>
      <DateField
        label="Date the work finished"
        hint="Today, or an earlier day"
        value={date}
        onChange={setDate}
        max={today()}
        error={problems.finishedOn}
      />
      {notice}
      <Button primary label="Mark Done" onPress={() => attempt(() => (p.markDone(job.id, date), onDone(date)))} />
    </Sheet>
  );
}

const local = StyleSheet.create({
  head: { gap: space.s2 },
  title: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  status: { fontWeight: '600' },
  notice: { borderWidth: size.hairline, borderRadius: radius.r, padding: space.s3, gap: space.s1 },
});
