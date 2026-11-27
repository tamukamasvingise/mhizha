import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SmallButton, useToast } from '../../ui/forms';
import { Choice, TextField } from '../../ui/fields';
import { Button, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { noAddress, type CustomerDetails, type CustomerKind } from '..';
import { fromContact } from '../fromContact';
import { AddressFields, styles, useProblems, usePeople, type Nav } from './common';

// Adding a Customer (with their first Site and an optional note), or changing
// one. A new Customer can be filled in from the phone's contacts.

const kinds = [
  { value: 'person', label: 'A person' },
  { value: 'organisation', label: 'An organisation' },
] as const;

const blank: CustomerDetails = { kind: 'person', name: '', phones: [''], whatsapp: '', email: '', address: noAddress, taxNumber: '' };

export function CustomerForm({ id, nav }: { id?: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const toast = useToast();
  const { problems, attempt } = useProblems();
  const [d, setD] = useState<CustomerDetails>(() => {
    if (!id) return blank;
    const x = p.customer(id);
    return { ...x, phones: x.phones.length > 0 ? x.phones : [''] };
  });
  const [firstSiteName, setFirstSiteName] = useState('');
  const [note, setNote] = useState('');
  const set = <K extends keyof CustomerDetails>(k: K) => (v: CustomerDetails[K]) => setD((old) => ({ ...old, [k]: v }));
  const setPhone = (i: number) => (v: string) => setD((old) => ({ ...old, phones: old.phones.map((x, j) => (j === i ? v : x)) }));

  const fillFromContacts = async () => {
    try {
      const allowed = await requestPermissionsAsync();
      if (!allowed.granted) {
        toast.show('Mhizha may not read your contacts. Type the details instead, or allow it in the phone settings.');
        return;
      }
      const picked = await Contact.presentPicker();
      if (!picked) return;
      const details = await picked.getDetails([
        ContactField.FULL_NAME,
        ContactField.GIVEN_NAME,
        ContactField.FAMILY_NAME,
        ContactField.COMPANY,
        ContactField.PHONES,
        ContactField.EMAILS,
        ContactField.ADDRESSES,
      ]);
      const fill = fromContact(details);
      setD((old) => ({ ...old, ...fill, phones: fill.phones.length > 0 ? fill.phones : [''] }));
      toast.show('Filled in from your contacts. Check the details, then save.');
    } catch {
      toast.show('The contact could not be read. Type the details instead.');
    }
  };

  const save = () => {
    attempt(() => {
      if (id) {
        p.updateCustomer(id, d);
        nav.back();
      } else {
        const made = p.addCustomer({ ...d, firstSiteName, note });
        nav.replace({ screen: 'customer', id: made });
      }
    });
  };

  const errorCount = Object.keys(problems).length;
  return (
    <View style={styles.screen}>
      <SubTopBar title={id ? 'Change Customer' : 'New Customer'} onBack={nav.back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
        {id ? null : (
          <SmallButton icon="people" label="Fill in from phone contacts" onPress={() => void fillFromContacts()} />
        )}
        <Choice<CustomerKind> label="Who is it?" options={kinds} value={d.kind} onChange={set('kind')} />
        <TextField
          label={d.kind === 'person' ? 'Name' : 'Name of the organisation'}
          value={d.name}
          onChange={set('name')}
          error={problems.name}
        />
        <View style={styles.group}>
          {d.phones.map((ph, i) => (
            <TextField
              key={i}
              label={i === 0 ? 'Phone (optional)' : `Phone ${i + 1} (optional)`}
              hint={i === 0 ? 'For example 077 123 4567' : undefined}
              keyboardType="phone-pad"
              value={ph}
              onChange={setPhone(i)}
              error={problems[`phones.${i}`]}
            />
          ))}
          <View style={styles.buttons}>
            <SmallButton icon="plus" label="Add another phone" onPress={() => set('phones')([...d.phones, ''])} />
          </View>
        </View>
        <TextField
          label="WhatsApp number (optional)"
          hint="Leave empty to use the first phone"
          keyboardType="phone-pad"
          value={d.whatsapp}
          onChange={set('whatsapp')}
          error={problems.whatsapp}
        />
        <TextField label="Email (optional)" keyboardType="email-address" value={d.email} onChange={set('email')} error={problems.email} />
        <AddressFields value={d.address} onChange={set('address')} />
        <TextField label="Tax number (optional)" hint="BP or VAT number, if they have one" value={d.taxNumber} onChange={set('taxNumber')} />
        {id ? null : (
          <>
            <TextField
              label="First Site (optional)"
              hint='Where the work is done, for example "House". It takes the address above. Add more Sites later.'
              value={firstSiteName}
              onChange={setFirstSiteName}
            />
            <TextField label="Note (optional)" hint="For example: prefers WhatsApp" value={note} onChange={setNote} />
          </>
        )}
        {errorCount > 0 ? (
          <Text accessibilityLiveRegion="polite" style={[parts.small, { color: c.bad }]}>
            {errorCount === 1 ? '! Fix the field marked above, then save.' : '! Fix the fields marked above, then save.'}
          </Text>
        ) : null}
        <Button primary label={id ? 'Save changes' : 'Save Customer'} onPress={save} />
      </ScrollView>
      {toast.view}
    </View>
  );
}
