import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, SubTopBar } from '../../ui/parts';
import { Choice, TextField } from '../../ui/fields';
import type { JobDetails } from '..';
import { styles, useProblems, usePeople, type Nav } from './common';

// Adding or changing a Job: what the work is, and at which of the Customer's Sites.

export function JobForm({ customerId, id, nav }: { customerId: string; id?: string; nav: Nav }) {
  const p = usePeople();
  const { problems, attempt } = useProblems();
  const sites = p.sites(customerId);
  const [d, setD] = useState<JobDetails>(() => {
    if (!id) return { title: '', siteId: sites[0]?.id ?? '' };
    const j = p.job(id);
    return { title: j.title, siteId: j.siteId };
  });
  // A Job's own Site stays offered even if it has since been archived.
  const current = id && !sites.some((s) => s.id === d.siteId) ? [p.site(d.siteId)] : [];
  const options = [...sites, ...current].map((s) => ({ value: s.id, label: s.archived ? `${s.name} (archived)` : s.name }));

  const save = () =>
    attempt(() => {
      if (id) {
        p.updateJob(id, d);
        nav.back();
      } else nav.replace({ screen: 'job', id: p.addJob(customerId, d) });
    });

  return (
    <View style={styles.screen}>
      <SubTopBar title={id ? 'Change Job' : 'New Job'} onBack={nav.back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.main}>
        <TextField
          label="What is the work?"
          hint='For example "Borehole pump wiring"'
          value={d.title}
          onChange={(title) => setD({ ...d, title })}
          error={problems.title}
          autoFocus={!id}
        />
        <Choice label="At which Site?" options={options} value={d.siteId} onChange={(siteId) => setD({ ...d, siteId })} error={problems.siteId} />
        <Button primary label={id ? 'Save changes' : 'Add Job'} onPress={save} />
      </ScrollView>
    </View>
  );
}
