import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { totalOwed } from '../../ledger';
import type { Nav } from '../../people/screens/common';
import { useDb } from '../../shell/Records';
import { tabs } from '../../shell/navigation';
import { Choice } from '../../ui/fields';
import { EmptyState, styles as parts } from '../../ui/parts';
import { useColours } from '../../ui/theme';
import { lineHeight, space, type } from '../../ui/tokens';
import type { ListFilter } from '..';
import { DocumentList, useDocuments } from './common';

// Home's big figure and the Documents tab.

/** Home: "Customers owe you" is the one big figure. Until anything is issued, it says what to do first. */
export function HomeTab() {
  const c = useColours();
  const db = useDb();
  const d = useDocuments();
  const owed = totalOwed(db);
  const home = tabs.find((t) => t.id === 'home')!;
  return (
    <>
      <View accessible accessibilityLabel={`Customers owe you ${formatUsd(owed)}`} style={styles.figure}>
        <Text style={[parts.body, styles.figureLabel, { color: c.label }]}>Customers owe you</Text>
        <Text style={[styles.big, { color: c.fg }]}>{formatUsd(owed)}</Text>
      </View>
      {d.list().length === 0 ? <EmptyState title={home.empty.title} body={home.empty.body} /> : null}
    </>
  );
}

const FILTERS: { value: ListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'receipts', label: 'Receipts' },
];

const EMPTY: Record<Exclude<ListFilter, 'all'>, string> = {
  drafts: 'No Drafts. A Document you start and have not issued waits here.',
  quotations: 'No Quotations yet.',
  invoices: 'No Invoices yet. Tap New, then Invoice.',
  receipts: 'No Receipts yet. A Receipt is made when you record a Payment.',
};

/** Drafts first, then the newest Issued, with filters. */
export function DocumentsTab({ nav }: { nav: Nav }) {
  const c = useColours();
  const d = useDocuments();
  const [filter, setFilter] = useState<ListFilter>('all');
  const all = d.list();
  if (all.length === 0) {
    const t = tabs.find((x) => x.id === 'documents')!;
    return <EmptyState title={t.empty.title} body={t.empty.body} />;
  }
  const items = filter === 'all' ? all : d.list({ filter });
  return (
    <View style={styles.group}>
      <Choice label="Show" options={FILTERS} value={filter} onChange={setFilter} />
      {items.length > 0 ? (
        <DocumentList items={items} nav={nav} />
      ) : (
        <Text style={[parts.body, { color: c.label }]}>{EMPTY[filter as Exclude<ListFilter, 'all'>]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: space.s1 },
  figureLabel: { fontWeight: '600' },
  big: { fontSize: type.xl, lineHeight: lineHeight(type.xl), fontWeight: '700', fontVariant: ['tabular-nums'] },
  group: { gap: space.s4 },
});
