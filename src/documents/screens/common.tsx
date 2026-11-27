import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatUsd } from '../../core';
import { shortDate } from '../../dates';
import type { Nav } from '../../people/screens/common';
import { useDb } from '../../shell/Records';
import { invoiceSteps } from '../../shell/navigation';
import { List, Row } from '../../ui/forms';
import { useColours } from '../../ui/theme';
import { lineHeight, type } from '../../ui/tokens';
import { documents, type Documents, type ListItem } from '..';

// What the Document screens share.

/** Documents over the open records, with the phone's clock. */
export function useDocuments(): Documents {
  const db = useDb();
  return useMemo(() => documents(db, Date.now), [db]);
}

/** A status in words. Red only for Overdue, Declined and Cancelled, and then with "! ". */
export const STATUS_WORDS: Record<ListItem['status'], string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  'part-paid': 'Part-paid',
  paid: '✓ Paid',
  overdue: '! Overdue',
  closed: 'Closed',
  received: 'Received',
  issued: 'Issued',
  accepted: 'Accepted',
  declined: '! Declined',
  expired: 'Expired',
  superseded: 'Superseded',
  cancelled: '! Cancelled',
};

/** Whether a status is shown in red. */
export const isBad = (status: ListItem['status']) => STATUS_WORDS[status].startsWith('! ');

/** Opens a Document: a Draft at its last step, with the earlier steps behind it; an Issued one on its own screen. */
export function openDocument(nav: Nav, item: Pick<ListItem, 'id' | 'draft'>) {
  if (item.draft) for (const step of invoiceSteps) nav.open({ screen: 'invoice-step', step, id: item.id });
  else nav.open({ screen: 'document', id: item.id });
}

/** An amount at the right of a row: tabular figures, weight 600; the status in words under it. */
export function AmountAndStatus({ cents, status }: { cents: number; status: ListItem['status'] }) {
  const c = useColours();
  return (
    <View style={styles.right}>
      <Text style={[styles.amount, { color: c.fg }]}>{formatUsd(cents)}</Text>
      <Text style={[styles.status, { color: isBad(status) ? c.bad : c.label, fontWeight: isBad(status) ? '700' : '400' }]}>
        {STATUS_WORDS[status]}
      </Text>
    </View>
  );
}

/** Documents as list rows: number (or "Draft Invoice"), Customer, Job and date, the amount and status at the right. */
export function DocumentList({ items, nav, showCustomer = true }: { items: readonly ListItem[]; nav: Nav; showCustomer?: boolean }) {
  return (
    <List>
      {items.map((d, i) => {
        const subtitle = [showCustomer ? d.customerName : '', d.jobTitle, shortDate(d.date)].filter(Boolean).join(' · ');
        return (
          <Row
            key={d.id}
            first={i === 0}
            title={d.title}
            subtitle={subtitle}
            label={`${d.title}, ${subtitle}, ${formatUsd(d.total)}, ${STATUS_WORDS[d.status].replace(/^[!✓] /, '')}`}
            right={<AmountAndStatus cents={d.total} status={d.status} />}
            onPress={() => openDocument(nav, d)}
          />
        );
      })}
    </List>
  );
}

export const styles = StyleSheet.create({
  right: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { fontSize: type.m, lineHeight: lineHeight(type.m), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  status: { fontSize: type.s, lineHeight: lineHeight(type.s) },
});
