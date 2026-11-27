import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useToast } from '../../ui/forms';
import { TextField } from '../../ui/fields';
import { Button, SubTopBar, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { InputError, type SiteDetails } from '..';
import { AddressFields, styles, useProblems, usePeople, type Nav } from './common';

// Adding or changing a Site: its name, address and an optional contact person.

export function SiteForm({ customerId, id, nav }: { customerId: string; id?: string; nav: Nav }) {
  const c = useColours();
  const p = usePeople();
  const toast = useToast();
  const { problems, attempt } = useProblems();
  const existing = id ? p.site(id) : null;
  const [d, setD] = useState<SiteDetails>(() =>
    existing
      ? { name: existing.name, address: existing.address, contactName: existing.contactName, contactPhone: existing.contactPhone }
      : { name: '', address: p.customer(customerId).address, contactName: '', contactPhone: '' },
  );
  const [archived, setArchived] = useState(existing?.archived ?? false);
  const set = <K extends keyof SiteDetails>(k: K) => (v: SiteDetails[K]) => setD((old) => ({ ...old, [k]: v }));

  const save = () =>
    attempt(() => {
      if (id) p.updateSite(id, d);
      else p.addSite(customerId, d);
      nav.back();
    });

  const archive = () => {
    try {
      p.archiveSite(id!);
      setArchived(true);
      toast.show('Site archived. New Jobs cannot be put here. Its Jobs are kept.', {
        label: 'Undo',
        onPress: () => {
          p.unarchiveSite(id!);
          setArchived(false);
        },
      });
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      toast.show(e.message);
    }
  };

  return (
    <View style={styles.screen}>
      <SubTopBar title={id ? 'Change Site' : 'New Site'} onBack={nav.back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
        {archived ? <Text style={[parts.body, { color: c.label }]}>This Site is archived.</Text> : null}
        <TextField label="Site name" hint='For example "House" or "Staff cottages"' value={d.name} onChange={set('name')} error={problems.name} />
        <AddressFields value={d.address} onChange={set('address')} />
        <TextField label="Contact person at the Site (optional)" value={d.contactName} onChange={set('contactName')} />
        <TextField
          label="Their phone (optional)"
          keyboardType="phone-pad"
          value={d.contactPhone}
          onChange={set('contactPhone')}
          error={problems.contactPhone}
        />
        <Button primary label={id ? 'Save changes' : 'Add Site'} onPress={save} />
        {id ? (
          archived ? (
            <Button
              label="Bring back from the archive"
              onPress={() => {
                p.unarchiveSite(id);
                setArchived(false);
                toast.show('The Site is back.');
              }}
            />
          ) : (
            <Button label="Archive Site" onPress={archive} />
          )
        ) : null}
      </ScrollView>
      {toast.view}
    </View>
  );
}
