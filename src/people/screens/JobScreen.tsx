import { useReducer, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { longDate, shortDate, today } from '../../dates';
import { DateField, Section, useToast } from '../../ui/forms';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import type { Job } from '..';
import { styles, useProblems, usePeople, type Nav } from './common';

// One Job: its Customer and Site, Open, Done or Dropped, set by hand. Marking
// it Done asks for the date work finished: today, or an earlier day.

/** Open, "Done 26 Nov 2026" or Dropped, plus "archived". */
export function jobStatusWord(j: Job): string {
  const word = j.status === 'open' ? 'Open' : j.status === 'dropped' ? 'Dropped' : `Done ${shortDate(j.finishedOn)}`;
  return j.archived ? `${word}, archived` : word;
}

export function JobScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const toast = useToast();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [sheet, setSheet] = useState<'done' | 'drop' | null>(null);
  const j = p.job(id);
  const customer = p.customer(j.customerId);

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

        <Section title="Documents for this Job">
          <Text style={[parts.body, { color: c.label }]}>None yet. Quotations and Invoices for this Job show here.</Text>
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
        onDone={(date) => {
          setSheet(null);
          refresh();
          toast.show(`Marked Done. Work finished ${longDate(date)}.`);
        }}
      />
      <Sheet visible={sheet === 'drop'} title={`Drop ${j.title}?`} onClose={() => setSheet(null)}>
        <Text style={[parts.body, { color: c.fg }]}>The Job stays in your records, marked Dropped. You can open it again later.</Text>
        <Button
          primary
          label="Mark Dropped"
          onPress={() => {
            p.markDropped(id);
            setSheet(null);
            refresh();
            toast.show('Job marked Dropped.');
          }}
        />
      </Sheet>
      {toast.view}
    </View>
  );
}

function DoneSheet({ job, visible, onClose, onDone }: { job: Job; visible: boolean; onClose: () => void; onDone: (date: string) => void }) {
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
      <Button primary label="Mark Done" onPress={() => attempt(() => (p.markDone(job.id, date), onDone(date)))} />
    </Sheet>
  );
}

const local = StyleSheet.create({
  head: { gap: space.s2 },
  title: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  status: { fontWeight: '600' },
});
