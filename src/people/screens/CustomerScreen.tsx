import { useReducer, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { longDate, shortDate, today } from '../../dates';
import { DocumentList, useDocuments } from '../../documents/screens/common';
import { customerHeld, customerOwes } from '../../ledger';
import { useDb } from '../../shell/Records';
import { DateField, List, Row, Section, SmallButton, useToast } from '../../ui/forms';
import { TextField } from '../../ui/fields';
import { Button, Sheet, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import { addressLine, type Customer, type Note } from '..';
import { callLink, whatsappFor, whatsappLink } from '../contact';
import { openLink, styles, useProblems, usePeople, type Nav } from './common';
import { jobStatusWord } from './JobScreen';

// One Customer: Call and WhatsApp first, then the follow-up date, Jobs, notes,
// Sites, Documents and the contact details.

export function CustomerScreen({ id, nav }: { id: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const db = useDb();
  const d = useDocuments();
  const toast = useToast();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [noteOpen, setNoteOpen] = useState<Note | 'new' | null>(null);

  const x = p.customer(id);
  const followUp = p.followUp(id);
  const jobs = p.jobs(id, { archived: showArchivedJobs });
  const anyArchivedJobs = showArchivedJobs || p.jobs(id, { archived: true }).length > 0;
  const notes = p.notes(id);
  const sites = p.sites(id, { archived: true });
  const phone = x.phones[0] ?? '';
  const whatsapp = whatsappFor(x);
  const failed = (m: string) => toast.show(m);
  const docs = d.list({ customerId: id });
  const owes = customerOwes(db, id);
  const held = customerHeld(db, id);
  const heldText = [
    held.deposits > 0 ? `Deposits held ${formatUsd(held.deposits)}` : '',
    held.credit > 0 ? `Credit held ${formatUsd(held.credit)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const newInvoice = () => {
    const draftId = d.newInvoice(id);
    nav.open({ screen: 'invoice-step', step: 'job', id: draftId });
  };

  const setFollowUp = (date: string) => {
    p.setFollowUp(id, date);
    refresh();
    toast.show(`Follow-up set for ${longDate(date)}.`);
  };
  const followUpDone = () => {
    const was = followUp!.dueDate;
    p.followUpDone(id);
    refresh();
    const undo = {
      label: 'Undo',
      onPress: () => {
        p.setFollowUp(id, was);
        refresh();
      },
    };
    toast.show('Follow-up marked done.', was >= today() ? undo : undefined);
  };
  const archive = () => {
    p.archiveCustomer(id);
    refresh();
    toast.show(`${x.name} is archived and hidden from lists. Their records are kept.`, {
      label: 'Undo',
      onPress: () => {
        p.unarchiveCustomer(id);
        refresh();
      },
    });
  };

  return (
    <View style={styles.screen}>
      <SubTopBar title={x.name} onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={local.head}>
          <Text style={[parts.small, { color: c.label }]}>
            {[x.kind === 'person' ? 'Person' : 'Organisation', x.archived ? 'Archived' : ''].filter(Boolean).join(' · ')}
          </Text>
          <Text accessibilityRole="header" style={[local.name, { color: c.fg }]}>
            {x.name}
          </Text>
          {owes > 0 ? (
            <Text style={[parts.body, local.owes, { color: c.fg }]}>{`Owes you ${formatUsd(owes)}`}</Text>
          ) : null}
          {heldText ? <Text style={[parts.body, local.owes, { color: c.label }]}>{`${heldText}. Their money, kept for them.`}</Text> : null}
          {phone || whatsapp ? (
            <View style={styles.buttons}>
              {phone ? (
                <SmallButton
                  icon="phone"
                  label="Call"
                  a11yLabel={`Call ${x.name} on ${phone}`}
                  onPress={() => void openLink(callLink(phone), failed, 'the dialler')}
                />
              ) : null}
              {whatsapp ? (
                <SmallButton
                  icon="chat"
                  label="WhatsApp"
                  a11yLabel={`WhatsApp ${x.name} on ${whatsapp}`}
                  onPress={() => void openLink(whatsappLink(whatsapp), failed, 'WhatsApp')}
                />
              ) : null}
            </View>
          ) : (
            <Text style={[parts.body, { color: c.label }]}>No phone number yet. Tap Change details to add one.</Text>
          )}
          {owes > 0 ? <Button primary label="Record Payment" onPress={() => nav.open({ screen: 'payment', customerId: id })} /> : null}
        </View>

        <View style={styles.group}>
          <DateField
            label="Follow up on"
            value={followUp?.dueDate ?? ''}
            onChange={setFollowUp}
            min={today()}
            hint={
              followUp
                ? followUp.dueDate <= today()
                  ? 'Due now. Mark it done once you have been in touch.'
                  : 'The day to get back to this Customer.'
                : 'Pick a day to get back to this Customer.'
            }
          />
          {followUp ? (
            <View style={styles.buttons}>
              <SmallButton label="Mark follow-up done" onPress={followUpDone} />
            </View>
          ) : null}
        </View>

        <Section
          title="Jobs"
          action={x.archived ? null : <SmallButton icon="plus" label="Add Job" onPress={() => nav.open({ screen: 'job-form', customerId: id })} />}
        >
          {jobs.length > 0 ? (
            <List>
              {jobs.map((j, i) => (
                <Row
                  key={j.id}
                  first={i === 0}
                  title={j.title}
                  subtitle={`${j.siteName} · ${jobStatusWord(j)}`}
                  onPress={() => nav.open({ screen: 'job', id: j.id })}
                />
              ))}
            </List>
          ) : (
            <Text style={[parts.body, { color: c.label }]}>
              {showArchivedJobs ? 'No archived Jobs.' : 'No Jobs yet. A Job is one piece of work at one Site. Tap Add Job.'}
            </Text>
          )}
          {anyArchivedJobs ? (
            <View style={styles.buttons}>
              <SmallButton
                label={showArchivedJobs ? 'Show current Jobs' : 'Show archived Jobs'}
                onPress={() => setShowArchivedJobs(!showArchivedJobs)}
              />
            </View>
          ) : null}
        </Section>

        <Section title="Notes" action={<SmallButton icon="plus" label="Add note" onPress={() => setNoteOpen('new')} />}>
          {notes.length > 0 ? (
            <List>
              {notes.map((n, i) => (
                <Row
                  key={n.id}
                  first={i === 0}
                  title={n.text}
                  subtitle={shortDate(n.date)}
                  label={`Note of ${longDate(n.date)}: ${n.text}. Tap to change it.`}
                  onPress={() => setNoteOpen(n)}
                />
              ))}
            </List>
          ) : (
            <Text style={[parts.body, { color: c.label }]}>No notes yet. Notes are for you, never printed.</Text>
          )}
        </Section>

        <Section
          title="Sites"
          action={<SmallButton icon="plus" label="Add Site" onPress={() => nav.open({ screen: 'site-form', customerId: id })} />}
        >
          <List>
            {sites.map((s, i) => (
              <Row
                key={s.id}
                first={i === 0}
                title={s.name}
                subtitle={[s.archived ? 'Archived' : '', addressLine(s.address), s.contactName ? `Contact: ${s.contactName}` : ''].filter(Boolean).join(' · ') || undefined}
                onPress={() => nav.open({ screen: 'site-form', customerId: id, id: s.id })}
              />
            ))}
          </List>
        </Section>

        <Section
          title="Documents"
          action={x.archived ? null : <SmallButton icon="plus" label="New Invoice" onPress={newInvoice} />}
        >
          {docs.length > 0 ? (
            <DocumentList items={docs} nav={nav} showCustomer={false} />
          ) : (
            <Text style={[parts.body, { color: c.label }]}>No Documents yet. Quotations, Invoices and Receipts for this Customer show here.</Text>
          )}
        </Section>

        <Section title="Contact details">
          <List>
            {details(x).map(([k, v], i) => (
              <Row key={k} first={i === 0} title={v} subtitle={k} label={`${k}: ${v}`} />
            ))}
          </List>
        </Section>

        <View style={styles.group}>
          <Button label="Change details" onPress={() => nav.open({ screen: 'customer-form', id })} />
          {x.archived ? (
            <Button
              label="Bring back from the archive"
              onPress={() => {
                p.unarchiveCustomer(id);
                refresh();
                toast.show(`${x.name} is back in your Customers.`);
              }}
            />
          ) : (
            <>
              <Button label="Archive Customer" onPress={archive} />
              <Text style={[parts.small, { color: c.label }]}>
                Archived Customers are hidden from lists and pickers. Nothing about them is deleted.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
      <NoteSheet
        customerId={id}
        note={noteOpen}
        onClose={() => setNoteOpen(null)}
        onSaved={(m) => {
          setNoteOpen(null);
          refresh();
          toast.show(m);
        }}
      />
      {toast.view}
    </View>
  );
}

function details(x: Customer): [string, string][] {
  const rows: [string, string][] = [];
  x.phones.forEach((ph, i) => rows.push([x.phones.length > 1 ? `Phone ${i + 1}` : 'Phone', ph]));
  if (x.whatsapp) rows.push(['WhatsApp', x.whatsapp]);
  if (x.email) rows.push(['Email', x.email]);
  const a = addressLine(x.address);
  if (a) rows.push(['Address', a]);
  if (x.taxNumber) rows.push(['Tax number', x.taxNumber]);
  if (rows.length === 0) rows.push(['Contact details', 'None yet']);
  return rows;
}

function NoteSheet({
  customerId,
  note,
  onClose,
  onSaved,
}: {
  customerId: string;
  note: Note | 'new' | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const p = usePeople();
  const { problems, attempt, clear } = useProblems();
  const [text, setText] = useState('');
  const [openFor, setOpenFor] = useState<Note | 'new' | null>(null);
  if (note !== openFor) {
    setOpenFor(note);
    setText(note && note !== 'new' ? note.text : '');
    clear();
  }
  const save = () =>
    attempt(() => {
      if (note === 'new') p.addNote(customerId, text);
      else if (note) p.updateNote(note.id, text);
      onSaved(note === 'new' ? 'Note added.' : 'Note changed.');
    });
  return (
    <Sheet visible={note !== null} title={note === 'new' ? 'Add a note' : 'Change the note'} onClose={onClose}>
      <TextField label="Note" value={text} onChange={setText} error={problems.note} autoFocus />
      <Button primary label="Save note" onPress={save} />
    </Sheet>
  );
}

const local = StyleSheet.create({
  head: { gap: space.s2 },
  name: { fontSize: type.l, lineHeight: lineHeight(type.l), fontWeight: '700' },
  owes: { fontWeight: '600', fontVariant: ['tabular-nums'] },
});
